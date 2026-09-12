const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    createFloatingWindow: (o) => ipcRenderer.invoke('create-floating-window', o),
    closeFloatingWindow: () => ipcRenderer.invoke('close-floating-window'),
    minimizeFloatingWindow: () => ipcRenderer.invoke('minimize-floating-window'),
    toggleMaximizeFloatingWindow: () => ipcRenderer.invoke('toggle-maximize-floating-window'),
    returnFloatingToMain: (d) => ipcRenderer.invoke('return-floating-to-main', d),
    onRestoreWindowInMain: (cb) => ipcRenderer.on('restore-window-in-main', (e, d) => cb(d)),
    getDeviceSettings: () => ipcRenderer.invoke('get-device-settings'),
    setDeviceSettings: (d) => ipcRenderer.invoke('set-device-settings', d),
    getAutostart: () => ipcRenderer.invoke('get-autostart'),
    setAutostart: (en) => ipcRenderer.invoke('set-autostart', en),
    goStart: (lang) => ipcRenderer.invoke('go-start', lang),
    startServerAndCreate: (nick, lang) => ipcRenderer.invoke('start-server-and-create', nick, lang),
    connectToServer: (info) => ipcRenderer.invoke('connect-to-server', info),
    onServersFound: (cb) => ipcRenderer.on('servers-found', (event, list) => cb(list)),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getMusicDir: () => ipcRenderer.invoke('get-music-dir'),
    setMusicDir: (dir) => ipcRenderer.invoke('set-music-dir', dir),
    startMusicShare: () => ipcRenderer.invoke('start-music-share'),
    getLanIp: () => ipcRenderer.invoke('get-lan-ip')
    
});