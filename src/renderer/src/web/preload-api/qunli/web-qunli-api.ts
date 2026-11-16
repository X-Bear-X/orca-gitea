import type { PreloadApi } from '../../../../../preload/api-types'
import { callRuntimeResult } from '../../runtime/client/web-runtime-calls'

const QUNLI_NETWORK_TIMEOUT_MS = 30_000

function qunliCall<TResult>(method: string, params?: unknown) {
  return callRuntimeResult<TResult>(`qunli.${method}`, params, QUNLI_NETWORK_TIMEOUT_MS)
}

export function createWebQunliApi(): PreloadApi['qunli'] {
  return {
    connect: (args) => qunliCall('connect', args),
    disconnect: async () => {
      await qunliCall('disconnect')
    },
    status: () => qunliCall('status'),
    testConnection: () => qunliCall('testConnection'),
    metadata: (args) => qunliCall('metadata', args),
    listTasks: (args) => qunliCall('listTasks', args),
    getTask: (args) => qunliCall('getTask', args),
    taskComments: (args) => qunliCall('taskComments', args),
    updateTaskStatus: (args) => qunliCall('updateTaskStatus', args)
  }
}
