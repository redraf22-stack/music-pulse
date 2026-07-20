const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
require('dotenv').config();

let mainWindow;
let tray = null;
let musicFolderPath = '';

// Проверка наличия Radmin VPN
function hasRadminVPN() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('radmin') || name.toLowerCase().includes('tap') || name.toLowerCase().includes('vpn')) {
            return true;
        }
    }
    return false;
}

function createWindow() {
    const iconPath = path.join(__dirname, 'build', 'icon.png');
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Music Pulse',
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        }
    });

    mainWindow.loadFile('index.html');

    // Tray setup
    if (process.platform !== 'darwin') {
        const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        tray = new Tray(trayIcon);
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Открыть Music Pulse', click: () => mainWindow.show() },
            { type: 'separator' },
            { label: 'Выход', click: () => app.quit() }
        ]);
        tray.setToolTip('Music Pulse');
        tray.setContextMenu(contextMenu);
        tray.on('click', () => mainWindow.show());
    }

    mainWindow.on('close', (e) => {
        if (process.platform !== 'darwin') {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC: Выбор папки с музыкой
ipcMain.handle('select-music-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Выберите папку с музыкой для Music Pulse'
    });
    if (!result.canceled && result.filePaths.length > 0) {
        musicFolderPath = result.filePaths[0];
        return musicFolderPath;
    }
    return null;
});

// IPC: Сканирование папки (безопаснее делать в main процессе)
ipcMain.handle('scan-music-folder', async () => {
    if (!musicFolderPath || !fs.existsSync(musicFolderPath)) return [];
    const { parseFile } = require('music-metadata');
    const files = fs.readdirSync(musicFolderPath).filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f));
    const tracks = [];
    
    for (const file of files.slice(0, 100)) { // Лимит для производительности
        try {
            const filePath = path.join(musicFolderPath, file);
            const metadata = await parseFile(filePath);
            tracks.push({
                filename: file,
                title: metadata.common.title || path.parse(file).name,
                artist: metadata.common.artist || 'Unknown Artist',
                album: metadata.common.album || '',
                duration: Math.floor(metadata.format.duration || 30),
                path: filePath // Путь для P2P стриминга
            });
        } catch (e) {
            // Пропускаем битые файлы
        }
    }
    return tracks;
});

// IPC: Источники для трансляции экрана
ipcMain.handle('get-screen-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 150, height: 150 } });
    return sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }));
});

// IPC: Статус сети (Radmin / Интернет)
ipcMain.handle('get-network-status', () => {
    return hasRadminVPN() ? 'radmin' : 'internet';
});

// Автообновления
function setupAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';

    // Если есть Radmin, можно настроить локальный сервер обновлений, иначе GitHub
    if (hasRadminVPN() && process.env.LOCAL_UPDATE_URL) {
        autoUpdater.setFeedURL({ provider: 'generic', url: process.env.LOCAL_UPDATE_URL });
    }

    autoUpdater.on('update-available', (info) => {
        mainWindow.webContents.send('update-available', info.version);
    });

    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-downloaded');
    });

    // Проверка при старте
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => console.log('Update check skipped (dev mode or no token):', err.message));
    }, 3000);
}

ipcMain.on('start-download-update', () => {
    autoUpdater.downloadUpdate();
});

ipcMain.on('restart-and-install', () => {
    autoUpdater.quitAndInstall();
});