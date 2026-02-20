import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  checkYtDlp: () => ipcRenderer.invoke('check-yt-dlp'),
  updateYtDlp: () => ipcRenderer.invoke('update-yt-dlp'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  downloadVideo: (url: string, options: any) => ipcRenderer.invoke('download-video', { url, options }),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  fetchVideoInfo: (url: string) => ipcRenderer.invoke('fetch-video-info', url),
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('set-setting', key, value),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onDownloadProgress: (callback: (progress: string) => void) => {
    ipcRenderer.on('download-progress', (_event, value: string) => callback(value))
  },
  onInitProgress: (callback: (data: { step: number; totalSteps: number; label: string; percent: number; done?: boolean; error?: boolean }) => void) => {
    ipcRenderer.on('init-progress', (_event, data) => callback(data))
  }
})
