const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const dgram = require('dgram');
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
    // ✅ Разрешаем трансляцию экрана в Electron
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
ipcMain.handle('start-server-and-create', async (event, nick) => {
    try {
        if (!localServer) localServer = await startServer(3001);
        const proto = localServer.isHttps ? 'https' : 'http';
        await mainWindow.loadURL(`${proto}://localhost:3001/room?mode=create&nick=${encodeURIComponent(nick || '')}`);
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
        if (info.roomCode) url += `room?mode=join&code=${encodeURIComponent(info.roomCode)}&nick=${encodeURIComponent(info.nick || '')}`;
        else url += `?nick=${encodeURIComponent(info.nick || '')}`;
        await mainWindow.loadURL(url);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});