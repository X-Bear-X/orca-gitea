import type { QunliTaskListFilter } from '../../../../shared/qunli/qunli-types'
import { connect, disconnect, getStatus, testConnection } from '../../../qunli/client'
import {
  getMetadata,
  getTask,
  listComments,
  listTasks,
  updateTaskStatus
} from '../../../qunli/qunli-tasks'

export class RuntimeQunliCommands {
  qunliConnect(apiKey: string): ReturnType<typeof connect> {
    return connect(apiKey)
  }

  qunliDisconnect(): { ok: true } {
    disconnect()
    return { ok: true }
  }

  qunliStatus(): ReturnType<typeof getStatus> {
    return getStatus()
  }

  qunliTestConnection(): ReturnType<typeof testConnection> {
    return testConnection()
  }

  qunliMetadata(force?: boolean): ReturnType<typeof getMetadata> {
    return getMetadata({ force })
  }

  qunliListTasks(filter: QunliTaskListFilter): ReturnType<typeof listTasks> {
    return listTasks(filter)
  }

  qunliGetTask(ref: string): ReturnType<typeof getTask> {
    return getTask(ref)
  }

  qunliTaskComments(ref: string): ReturnType<typeof listComments> {
    return listComments(ref)
  }

  qunliUpdateTaskStatus(ref: string, statusId: string): ReturnType<typeof updateTaskStatus> {
    return updateTaskStatus(ref, statusId)
  }
}
