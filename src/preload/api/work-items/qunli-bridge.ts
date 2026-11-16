import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../../api-types'

export const qunliApi = {
  connect: (args) => ipcRenderer.invoke('qunli:connect', args),
  disconnect: () => ipcRenderer.invoke('qunli:disconnect'),
  status: () => ipcRenderer.invoke('qunli:status'),
  testConnection: () => ipcRenderer.invoke('qunli:testConnection'),
  metadata: (args) => ipcRenderer.invoke('qunli:metadata', args),
  listTasks: (args) => ipcRenderer.invoke('qunli:listTasks', args),
  getTask: (args) => ipcRenderer.invoke('qunli:getTask', args),
  taskComments: (args) => ipcRenderer.invoke('qunli:taskComments', args),
  updateTaskStatus: (args) => ipcRenderer.invoke('qunli:updateTaskStatus', args)
} satisfies PreloadApi['qunli']
