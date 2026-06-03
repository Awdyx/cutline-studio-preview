import { contextBridge } from 'electron'

const isMac = process.platform === 'darwin'

contextBridge.exposeInMainWorld('cutlineShell', {
  kind: 'electron',
  macOverlay: isMac,
})
