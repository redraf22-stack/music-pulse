const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectMusicFolder: () => ipcRenderer.invoke('select-music-folder'),
    scanMusicFolder: () => ipcRenderer.invoke('scan-music-folder'),
    getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
    getNetworkStatus: () => ipcRenderer.invoke('get-network-status'),
    
    // Автообновления
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, version) => callback(version)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
    startDownloadUpdate: () => ipcRenderer.send('start-download-update'),
    restartAndInstall: () => ipcRenderer.send('restart-and-install'),
    
    // P2P Сигналинг (простой relay через main, если y-webrtc community сервера недоступны, 
    // но y-webrtc по умолчанию использует бесплатные публичные сервера)
    sendToMain: (channel, data) => ipcRenderer.send(channel, data),
    onMessageFromMain: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args))
});