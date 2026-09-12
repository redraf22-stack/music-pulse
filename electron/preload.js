const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    closeFloatingWindows: (f) => ipcRenderer.invoke('close-floating-windows', f || {}),
    createFloatingWindow: (o) => ipcRenderer.invoke('create-floating-window', o),
    closeFloatingWindow: (id) => ipcRenderer.invoke('close-floating-window', id),
    minimizeFloatingWindow: (id) => ipcRenderer.invoke('minimize-floating-window', id),
    toggleMaximizeFloatingWindow: (id) => ipcRenderer.invoke('toggle-maximize-floating-window', id),
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