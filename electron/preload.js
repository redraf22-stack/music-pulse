const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    startServerAndCreate: (nick) => ipcRenderer.invoke('start-server-and-create', nick),
    connectToServer: (info) => ipcRenderer.invoke('connect-to-server', info),
    onServersFound: (cb) => ipcRenderer.on('servers-found', (event, list) => cb(list))
});