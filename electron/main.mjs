import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEV_URL = process.env.CUTLINE_DEV_URL ?? 'http://localhost:5173'
const isDev = !app.isPackaged

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Cutline Studio',
    show: false,
    // Match Tauri `titleBarStyle: Overlay` — content to the window top; CSS nudges chrome below traffic lights.
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 14, y: 16 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const applyMacChromeInsets = () => {
    if (process.platform !== 'darwin') return
    void mainWindow?.webContents.executeJavaScript(`
      document.documentElement.dataset.nativeDesktop = '1';
      document.documentElement.dataset.electronDesktop = '1';
      document.documentElement.dataset.nativeMacos = '1';
      document.documentElement.dataset.electronMacos = '1';
    `)
  }

  mainWindow.webContents.on('did-finish-load', applyMacChromeInsets)
  mainWindow.webContents.on('did-navigate-in-page', applyMacChromeInsets)

  if (isDev) {
    void mainWindow.loadURL(DEV_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
