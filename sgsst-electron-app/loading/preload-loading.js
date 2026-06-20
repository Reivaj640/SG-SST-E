// loading/preload-loading.js
// Puente IPC exclusivo para la ventana de carga. NO modifica preload.js existente.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  updateProgress:  (percent) => ipcRenderer.send('loading-progress', percent),
  loadingComplete: ()        => ipcRenderer.send('loading-complete'),
  loadingError:    (message) => ipcRenderer.send('loading-error', message),
  getAppVersion:   ()        => ipcRenderer.invoke('get-app-version'),
});
