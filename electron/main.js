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
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
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
    if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => { mainWindow = null; });
}

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
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f)) : [];
        const list = [];
        for (const f of files) {
            let title = null, artist = null;
            try { const m = await mm.parseFile(path.join(dir, f)); title = m.common.title || null; artist = m.common.artist || null; } catch (e) {}
            const b = path.parse(f).name;
            if (!title) { if (b.includes('-')) { const p = b.split('-'); artist = artist || p[0].trim(); title = p.slice(1).join('-').trim(); } else title = b; }
            list.push({ file: f, title, artist: artist || 'Unknown Artist' });
        }
        const srv = http.createServer((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (req.url === '/list.json') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(list)); }
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
const fsMain = require('fs');
const MUSIC_SETTINGS = path.join(app.getPath('userData'), 'settings.json');
function readMusicSettings() { try { return JSON.parse(fsMain.readFileSync(MUSIC_SETTINGS, 'utf8')); } catch (e) { return {}; } }
function readMusicDir() { return readMusicSettings().musicDir || ''; }
ipcMain.handle('get-music-dir', () => readMusicDir());
ipcMain.handle('set-music-dir', (event, dir) => {
    try {
        const s = readMusicSettings();
        s.musicDir = dir;
        fsMain.writeFileSync(MUSIC_SETTINGS, JSON.stringify(s, null, 2));
        return { success: true };
    } catch (e) { return { success: false }; }
});
ipcMain.handle('go-start', async (event, lang) => {
    await mainWindow.loadFile(path.join(__dirname, '../src/start.html'), lang ? { query: { lang: String(lang) } } : {});
    return { success: true };
});