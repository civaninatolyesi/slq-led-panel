const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('slqDesktop', {
  platform: process.platform,
  version: process.versions.electron,
  onBluetoothDevices(cb) {
    const h = (_e, list) => cb(list)
    ipcRenderer.on('bt:devices', h)
    return () => ipcRenderer.removeListener('bt:devices', h)
  },
  selectBluetoothDevice: (id) => ipcRenderer.send('bt:select', id),
  autoSelectBluetoothDevice: (id) => ipcRenderer.invoke('bt:auto-select', id),
  openExternal: (url) => ipcRenderer.send('open-external', url),
})
