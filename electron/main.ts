import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { YtDlpManager } from './yt-dlp-manager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const ytDlpManager = new YtDlpManager()
let currentDownloadProcess: ReturnType<typeof ytDlpManager.downloadVideo> | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#94a3b8',
      height: 36
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  await ytDlpManager.checkAndDownloadBinaries()
  createWindow()
})

// IPC Handlers
ipcMain.handle('check-yt-dlp', async () => {
  await ytDlpManager.checkAndDownloadBinaries()
  return true
})

ipcMain.handle('update-yt-dlp', async () => {
  return await ytDlpManager.updateYtDlp()
})

ipcMain.handle('select-folder', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('download-video', async (_event, { url, options }) => {
  const outDir = options.outDir || app.getPath('downloads')

  return new Promise((resolve, reject) => {
    const proc = ytDlpManager.downloadVideo(url, { ...options, outDir }, (progress) => {
      win?.webContents.send('download-progress', progress)
    })
    currentDownloadProcess = proc

    proc.on('close', (code) => {
      currentDownloadProcess = null
      if (code === 0) {
        if (options.openAfter) shell.openPath(outDir)
        resolve(true)
      } else {
        reject(new Error(`Exit code ${code}`))
      }
    })
  })
})

ipcMain.handle('cancel-download', async () => {
  if (currentDownloadProcess) {
    currentDownloadProcess.kill('SIGTERM')
    currentDownloadProcess = null
    return true
  }
  return false
})
