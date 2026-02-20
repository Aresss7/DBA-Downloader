import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { YtDlpManager } from './yt-dlp-manager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
app.setName('DBA Downloader')
const ytDlpManager = new YtDlpManager()
let currentDownloadProcess: ReturnType<typeof ytDlpManager.downloadVideo> | null = null

// File-based settings
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function readSettings(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function writeSetting(key: string, value: any) {
  const settings = readSettings()
  settings[key] = value
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2))
}

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
  createWindow()
  try {
    await ytDlpManager.checkAndDownloadBinaries((data) => {
      win?.webContents.send('init-progress', data)
    })
    win?.webContents.send('init-progress', { step: 3, totalSteps: 3, label: 'Ready', percent: 100, done: true })
  } catch (err) {
    console.error('[init] Failed to download binaries:', err)
    win?.webContents.send('init-progress', { step: 0, totalSteps: 3, label: 'Download failed – restart the app to retry', percent: 0, error: true })
  }
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
  await ytDlpManager.checkAndDownloadBinaries()
  const outDir = options.outDir || app.getPath('downloads')

  return new Promise((resolve, reject) => {
    const proc = ytDlpManager.downloadVideo(url, { ...options, outDir }, (progress) => {
      win?.webContents.send('download-progress', progress)
    })
    currentDownloadProcess = proc

    proc.on('error', (err) => {
      currentDownloadProcess = null
      reject(new Error(`Failed to start yt-dlp: ${err.message}`))
    })

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

ipcMain.handle('fetch-video-info', async (_event, url: string) => {
  await ytDlpManager.checkAndDownloadBinaries()
  return await ytDlpManager.fetchInfo(url)
})

ipcMain.handle('get-setting', async (_event, key: string) => {
  return readSettings()[key] ?? null
})

ipcMain.handle('set-setting', async (_event, key: string, value: any) => {
  writeSetting(key, value)
  return true
})

ipcMain.handle('open-external', async (_event, url: string) => {
  await shell.openExternal(url)
  return true
})
