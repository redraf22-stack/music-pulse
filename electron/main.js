const { autoUpdater } = require('electron-updater');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const dgram = require('dgram');
const fs = require('fs');
const { startServer } = require('./server-wrapper');

// ✅ ДО того как приложение что-либо загрузит: игнорируем самоподписанный сертификат
app.commandLine.appendSwitch('ignore-certificate-errors');

// Убираем полоску меню сверху
Menu.setApplicationMenu(null);

const LAN_LISTEN_PORT = 33335;
let mainWindow = null, localServer = null, lanListener = null, foundServers = [];
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

// Слушаем UDP: комнаты, открытые для сети
function startLanListener() {
    try {
        lanListener = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        lanListener.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.type !== 'musicpulse-rooms') return;
                const entry = { ip: rinfo.address, port: data.port, https: data.https, rooms: data.rooms || [] };
                const idx = foundServers.findIndex(s => s.ip === entry.ip && s.port === entry.port);
                if (idx >= 0) foundServers[idx] = entry; else foundServers.push(entry);
                if (mainWindow) mainWindow.webContents.send('servers-found', foundServers);
            } catch (e) {}
        });
        lanListener.on('error', () => {});
        lanListener.bind(LAN_LISTEN_PORT);
    } catch (e) { console.warn('LAN listener failed:', e.message); }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400, height: 900, minWidth: 1000, minHeight: 700,
        icon: path.join(__dirname, '../build/icon.ico'),
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#181818', symbolColor: '#d0d0d0', height: 32 },
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' },
        title: 'MusicPulse'
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.webContents.on('before-input-event', (e, input) => {
        if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.code === 'KeyI'))) {
            mainWindow.webContents.toggleDevTools();
        }
    });
    // ✅ Разрешаем трансляцию экрана в Electron
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });
    mainWindow.webContents.session.setPermissionCheckHandler(() => true);
    mainWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
          const { desktopCapturer } = require('electron');
         const sources = await desktopCapturer.getSources({ types: ['screen'] });
         if (sources && sources.length) callback({ video: sources[0] });
         else callback({});
      } catch (e) { callback({}); }
    });
    mainWindow.loadFile(path.join(__dirname, '../src/start.html'));
    if (!process.argv.includes('--dev')) {
        let updateDownloaded = false;
        let updateDialogShown = false;

        const showUpdateDialog = () => {
            if (updateDialogShown || !mainWindow) return;
            updateDialogShown = true;
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
                type: 'info', title: 'Обновление готово',
                message: 'Новая версия MusicPulse скачана. Перезапустить сейчас?',
                buttons: ['Перезапустить', 'Позже']
            }).then(r => {
                updateDialogShown = false;
                if (r.response === 0) autoUpdater.quitAndInstall();
            });
        };

        autoUpdater.on('update-downloaded', () => {
            updateDownloaded = true;
            showUpdateDialog();
        });
        autoUpdater.on('error', e => console.error('Update error:', e.message));

        // Сразу при входе — проверяем обновления
        setTimeout(() => { autoUpdater.checkForUpdates(); }, 2000);

        // Каждые 30 минут: напоминаем, если уже скачано; иначе проверяем снова
        setInterval(() => {
            if (updateDownloaded) showUpdateDialog();
            else autoUpdater.checkForUpdates();
        }, 30 * 60 * 1000);
    }
    if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => { mainWindow = null; });
}

const floatingWindows = new Map();
let floatingSeq = 0;

ipcMain.handle('create-floating-window', async (event, opts) => {
    const winId = 'fw' + (++floatingSeq);
    const w = new BrowserWindow({
        width: opts.type === 'video' ? 480 : 640,
        height: opts.type === 'video' ? 360 : 480,
        x: 100 + floatingWindows.size * 40,
        y: 100 + floatingWindows.size * 40,
        alwaysOnTop: true,
        frame: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
    });
    let origin = 'http://localhost:3001';
    try { origin = new URL(mainWindow.getURL()).origin; } catch (e) {}
    const q = new URLSearchParams({ winId: winId, type: opts.type || 'screen', peerId: opts.peerId || '', userName: opts.userName || '', isSelf: String(!!opts.isSelf) });
    floatingWindows.set(winId, { win: w, meta: opts });
    w.on('closed', () => { floatingWindows.delete(winId); });
    await w.loadURL(`${origin}/floating.html?${q.toString()}`);
    return { success: true, winId: winId };
});

ipcMain.handle('close-floating-window', (event, winId) => { const f = floatingWindows.get(winId); if (f) f.win.close(); return { success: true }; });
ipcMain.handle('minimize-floating-window', (event, winId) => { const f = floatingWindows.get(winId); if (f) f.win.minimize(); return { success: true }; });
ipcMain.handle('toggle-maximize-floating-window', (event, winId) => { const f = floatingWindows.get(winId); if (f) { if (f.win.isMaximized()) f.win.unmaximize(); else f.win.maximize(); } return { success: true }; });
ipcMain.handle('return-floating-to-main', (event, { winId }) => {
    const f = floatingWindows.get(winId);
    if (f && mainWindow) {
        mainWindow.webContents.send('restore-window-in-main', f.meta);
        f.win.close();
        mainWindow.focus();
    }
    return { success: true };
});
ipcMain.handle('close-floating-windows', (event, filter) => {
    const f = filter || {};
    [...floatingWindows.entries()].forEach(([id, entry]) => {
        const m = entry.meta || {};
        const okType = !f.type || m.type === f.type;
        const okSelf = !f.isSelf || m.isSelf === true;
        const okPeer = !f.peerId || m.peerId === f.peerId;
        if (okType && okSelf && okPeer) entry.win.close();
    });
    return { success: true };
});

app.whenReady().then(() => { createWindow(); startLanListener(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Одна кнопка: запустить сервер и сразу создать комнату
ipcMain.handle('start-server-and-create', async (event, nick, lang) => {
    try {
        const md = readMusicDir(); if (md) process.env.MUSICPULSE_MUSIC = md;
        if (!localServer) localServer = await startServer(3001);
        const proto = localServer.isHttps ? 'https' : 'http';
        await mainWindow.loadURL(`${proto}://localhost:3001/room?mode=create&nick=${encodeURIComponent(nick || '')}&lang=${encodeURIComponent(lang || 'ru')}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to start server:', error);
        return { success: false, error: error.message };
    }
});

// Прямое подключение: IP:код (как в майне) или IP:порт
ipcMain.handle('connect-to-server', async (event, info) => {
    try {
        const proto = info.https ? 'https' : 'http';
        let url = `${proto}://${info.ip}:${info.port || 3001}/`;
        if (info.roomCode) url += `room?mode=join&code=${encodeURIComponent(info.roomCode)}&nick=${encodeURIComponent(info.nick || '')}&lang=${encodeURIComponent(info.lang || 'ru')}`;
        else url += `?nick=${encodeURIComponent(info.nick || '')}&lang=${encodeURIComponent(info.lang || 'ru')}`;
        await mainWindow.loadURL(url);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('select-folder', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
});
let musicShare = null;
ipcMain.handle('start-music-share', async () => {
    if (musicShare) return musicShare;
    try {
        const http = require('http');
        const mm = require('music-metadata');
        const dir = readMusicDir() || path.join(app.getPath('userData'), 'music');
        async function buildShareList() {
            const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f)) : [];
            let ovr = {}; try { ovr = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'music-overrides.json'), 'utf8')); } catch (e) {}
            const lanIp = (() => { const os = require('os'); const nets = os.networkInterfaces(); for (const k of Object.keys(nets)) for (const n of nets[k]) if (n.family === 'IPv4' && !n.internal) return n.address; return '127.0.0.1'; })();
            const protoS = localServer && localServer.isHttps ? 'https' : 'http';
            const list = [];
            for (const f of files) {
                let title = null, artist = null, meta = null;
                try { meta = await mm.parseFile(path.join(dir, f)); title = meta.common.title || null; artist = meta.common.artist || null; } catch (e) {}
                const b = path.parse(f).name;
                if (!title) { if (b.includes('-')) { const p = b.split('-'); artist = artist || p[0].trim(); title = p.slice(1).join('-').trim(); } else title = b; }
                const it = { file: f, title, artist: artist || 'Unknown Artist' };
                const o = ovr[f];
                if (o) { if (o.title) it.title = o.title; if (o.artist) it.artist = o.artist; }
                let coverRel = (o && ('cover' in o)) ? o.cover : null;
                if (coverRel === null) {
                    try {
                        let embCache = {}; try { embCache = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'embedded-covers.json'), 'utf8')); } catch (e) {}
                        if (f in embCache) coverRel = embCache[f];
                        else {
                            const pic = meta && meta.common.picture && meta.common.picture[0];
                            const cdir = path.join(app.getPath('userData'), 'covers');
                            if (!fs.existsSync(cdir)) fs.mkdirSync(cdir, { recursive: true });
                            if (pic) {
                                const cname = 'emb-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + (pic.format === 'image/png' ? '.png' : '.jpg');
                                fs.writeFileSync(path.join(cdir, cname), Buffer.from(pic.data));
                                coverRel = '/covers/' + cname;
                            } else coverRel = '';
                            embCache[f] = coverRel;
                            fs.writeFileSync(path.join(app.getPath('userData'), 'embedded-covers.json'), JSON.stringify(embCache));
                        }
                    } catch (e) {}
                }
                if (coverRel) it.cover = coverRel.startsWith('http') ? coverRel : (protoS + '://' + lanIp + ':3001' + coverRel);
                list.push(it);
            }
            return list;
        }
        const srv = http.createServer((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (req.url === '/list.json') {
                res.setHeader('Content-Type', 'application/json');
                buildShareList().then(l => res.end(JSON.stringify(l))).catch(() => res.end('[]'));
                return;
            }
            const fp = path.join(dir, decodeURIComponent(req.url.replace(/^\//, '').split('?')[0]));
            if (!fp.startsWith(dir) || !fs.existsSync(fp)) { res.statusCode = 404; return res.end(); }
            try {
                const stat = fs.statSync(fp);
                const range = req.headers.range;
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Content-Type', 'audio/mpeg');
                if (range) {
                    const m = String(range).match(/bytes=(\d*)-(\d*)/);
                    let start = m && m[1] ? parseInt(m[1]) : 0;
                    let end = m && m[2] ? parseInt(m[2]) : stat.size - 1;
                    if (isNaN(start) || start >= stat.size) { res.statusCode = 416; return res.end(); }
                    if (isNaN(end) || end >= stat.size) end = stat.size - 1;
                    res.statusCode = 206;
                    res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + stat.size);
                    res.setHeader('Content-Length', end - start + 1);
                    return fs.createReadStream(fp, { start, end }).pipe(res);
                }
                res.setHeader('Content-Length', stat.size);
                fs.createReadStream(fp).pipe(res);
            } catch (e) { res.statusCode = 500; res.end(); }
        });
        await new Promise(r => srv.listen(3005, '0.0.0.0', r));
        musicShare = { ok: true, port: 3005 };
        return musicShare;
    } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('get-lan-ip', () => {
    const os = require('os'); const nets = os.networkInterfaces();
    for (const k of Object.keys(nets)) for (const n of nets[k]) if (n.family === 'IPv4' && !n.internal) return n.address;
    return '127.0.0.1';
});
const MUSIC_SETTINGS = path.join(app.getPath('userData'), 'settings.json');
function readMusicSettings() { try { return JSON.parse(fs.readFileSync(MUSIC_SETTINGS, 'utf8')); } catch (e) { return {}; } }
function readMusicDir() { return readMusicSettings().musicDir || ''; }
ipcMain.handle('get-music-dir', () => readMusicDir());
ipcMain.handle('set-music-dir', (event, dir) => {
    try {
        const s = readMusicSettings();
        s.musicDir = dir;
        fs.writeFileSync(MUSIC_SETTINGS, JSON.stringify(s, null, 2));
        return { success: true };
    } catch (e) { return { success: false }; }
});
ipcMain.handle('get-device-settings', () => {
    const s = readMusicSettings();
    return {
        mic: s.mic || '', speaker: s.speaker || '', camera: s.camera || '',
        micLabel: s.micLabel || '', speakerLabel: s.speakerLabel || '', cameraLabel: s.cameraLabel || '',
        micGroup: s.micGroup || '', speakerGroup: s.speakerGroup || '', cameraGroup: s.cameraGroup || ''
    };
});
ipcMain.handle('set-device-settings', (event, d) => {
    try {
        const s = readMusicSettings();
        if (d.mic !== undefined) s.mic = d.mic;
        if (d.speaker !== undefined) s.speaker = d.speaker;
        if (d.camera !== undefined) s.camera = d.camera;
        if (d.micLabel !== undefined) s.micLabel = d.micLabel;
        if (d.speakerLabel !== undefined) s.speakerLabel = d.speakerLabel;
        if (d.cameraLabel !== undefined) s.cameraLabel = d.cameraLabel;
        if (d.micGroup !== undefined) s.micGroup = d.micGroup;
        if (d.speakerGroup !== undefined) s.speakerGroup = d.speakerGroup;
        if (d.cameraGroup !== undefined) s.cameraGroup = d.cameraGroup;
        fs.writeFileSync(MUSIC_SETTINGS, JSON.stringify(s, null, 2));
        return { success: true };
    } catch (e) { return { success: false }; }
});
ipcMain.handle('get-autostart', () => {
    try { return { enabled: !!app.getLoginItemSettings().openAtLogin }; } catch (e) { return { enabled: false }; }
});
ipcMain.handle('set-autostart', (event, en) => {
    try { app.setLoginItemSettings({ openAtLogin: !!en }); return { success: true }; } catch (e) { return { success: false }; }
});
ipcMain.handle('go-start', async (event, lang) => {
    await mainWindow.loadFile(path.join(__dirname, '../src/start.html'), lang ? { query: { lang: String(lang) } } : {});
    return { success: true };
});