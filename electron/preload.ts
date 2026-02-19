import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  checkYtDlp: () => ipcRenderer.invoke('check-yt-dlp'),
  updateYtDlp: () => ipcRenderer.invoke('update-yt-dlp'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  downloadVideo: (url: string, options: any) => ipcRenderer.invoke('download-video', { url, options }),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  onDownloadProgress: (callback: (progress: string) => void) => {
    ipcRenderer.on('download-progress', (_event, value: string) => callback(value))
  }
})
