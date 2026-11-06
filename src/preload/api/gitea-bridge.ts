import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const giteaApi = {
  prDetails: (args) => ipcRenderer.invoke('gitea:prDetails', args),
  jobLog: (args) => ipcRenderer.invoke('gitea:jobLog', args)
} satisfies PreloadApi['gitea']
