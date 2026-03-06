const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    printToPDF: (content) => ipcRenderer.invoke('print-to-pdf', content),
    getBackendUrl: () => ipcRenderer.invoke('get-backend-port')
});
