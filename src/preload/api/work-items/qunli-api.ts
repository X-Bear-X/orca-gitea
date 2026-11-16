import type {
  QunliAccountMetadata,
  QunliComment,
  QunliConnectionStatus,
  QunliMutationResult,
  QunliTaskPage,
  QunliTaskDetail,
  QunliTaskListFilter,
  QunliViewer
} from '../../../shared/qunli/qunli-types'

export type QunliConnectResult = { ok: true; viewer: QunliViewer } | { ok: false; error: string }

export type QunliApi = {
  connect: (args: { apiKey: string }) => Promise<QunliConnectResult>
  disconnect: () => Promise<void>
  status: () => Promise<QunliConnectionStatus>
  testConnection: () => Promise<QunliConnectResult>
  metadata: (args?: { force?: boolean }) => Promise<QunliAccountMetadata>
  listTasks: (args?: { filter?: QunliTaskListFilter }) => Promise<QunliTaskPage>
  getTask: (args: { ref: string }) => Promise<QunliTaskDetail | null>
  taskComments: (args: { ref: string }) => Promise<QunliComment[]>
  updateTaskStatus: (args: {
    ref: string
    statusId: string
  }) => Promise<QunliMutationResult<QunliTaskDetail>>
}
