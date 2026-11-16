import { ipcMain } from 'electron'
import {
  normalizeQunliTaskListFilter,
  normalizeQunliTaskRef
} from '../../../shared/qunli/qunli-task-ref'
import { connect, disconnect, getStatus, testConnection } from '../../qunli/client'
import {
  getMetadata,
  getTask,
  listComments,
  listTasks,
  updateTaskStatus
} from '../../qunli/qunli-tasks'
import { _resetPreflightCache } from '../../preflight/agent-detection'

export function registerQunliHandlers(): void {
  ipcMain.handle('qunli:connect', async (_event, args: { apiKey?: unknown }) => {
    const result = await connect(typeof args?.apiKey === 'string' ? args.apiKey : '')
    if (result.ok) {
      _resetPreflightCache()
    }
    return result
  })

  ipcMain.handle('qunli:disconnect', async () => {
    disconnect()
    _resetPreflightCache()
  })

  ipcMain.handle('qunli:status', async () => getStatus())

  ipcMain.handle('qunli:testConnection', async () => testConnection())

  ipcMain.handle('qunli:metadata', async (_event, args?: { force?: unknown }) =>
    getMetadata({ force: args?.force === true })
  )

  ipcMain.handle('qunli:listTasks', async (_event, args?: { filter?: unknown }) =>
    listTasks(normalizeQunliTaskListFilter(args?.filter))
  )

  ipcMain.handle('qunli:getTask', async (_event, args: { ref?: unknown }) =>
    getTask(normalizeQunliTaskRef(args?.ref))
  )

  ipcMain.handle('qunli:taskComments', async (_event, args: { ref?: unknown }) =>
    listComments(normalizeQunliTaskRef(args?.ref))
  )

  ipcMain.handle(
    'qunli:updateTaskStatus',
    async (_event, args: { ref?: unknown; statusId?: unknown }) => {
      if (typeof args?.statusId !== 'string' || !args.statusId.trim()) {
        return { ok: false, error: 'A status is required.' }
      }
      return updateTaskStatus(normalizeQunliTaskRef(args.ref), args.statusId.trim())
    }
  )
}
