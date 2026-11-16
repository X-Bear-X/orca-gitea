import type {
  QunliAccountMetadata,
  QunliComment,
  QunliConnectionStatus,
  QunliMutationResult,
  QunliTaskPage,
  QunliTaskDetail,
  QunliTaskListFilter
} from '../../../../shared/qunli/qunli-types'
import type { QunliConnectResult } from '../../../../preload/api/work-items/qunli-api'
import { callRuntimeRpc } from '../rpc/calls/runtime-rpc-call'
import { rowLessSourceTarget, type RowLessSource } from '../hosts/selection/default-creation-host'

const NETWORK_TIMEOUT_MS = 30_000

function call<T>(source: RowLessSource, method: string, params: unknown, local: () => Promise<T>) {
  const target = rowLessSourceTarget(source)
  return target.kind === 'environment'
    ? callRuntimeRpc<T>(target, `qunli.${method}`, params, { timeoutMs: NETWORK_TIMEOUT_MS })
    : local()
}

export function qunliStatus(source: RowLessSource): Promise<QunliConnectionStatus> {
  return call(source, 'status', undefined, () => window.api.qunli.status())
}

export function qunliConnect(source: RowLessSource, apiKey: string): Promise<QunliConnectResult> {
  return call(source, 'connect', { apiKey }, () => window.api.qunli.connect({ apiKey }))
}

export async function qunliDisconnect(source: RowLessSource): Promise<void> {
  await call<unknown>(source, 'disconnect', undefined, () => window.api.qunli.disconnect())
}

export function qunliTestConnection(source: RowLessSource): Promise<QunliConnectResult> {
  return call(source, 'testConnection', undefined, () => window.api.qunli.testConnection())
}

export function qunliMetadata(source: RowLessSource, force = false): Promise<QunliAccountMetadata> {
  return call(source, 'metadata', { force }, () => window.api.qunli.metadata({ force }))
}

export function qunliListTasks(
  source: RowLessSource,
  filter: QunliTaskListFilter
): Promise<QunliTaskPage> {
  return call(source, 'listTasks', { filter }, () => window.api.qunli.listTasks({ filter }))
}

export function qunliGetTask(source: RowLessSource, ref: string): Promise<QunliTaskDetail | null> {
  return call(source, 'getTask', { ref }, () => window.api.qunli.getTask({ ref }))
}

export function qunliTaskComments(source: RowLessSource, ref: string): Promise<QunliComment[]> {
  return call(source, 'taskComments', { ref }, () => window.api.qunli.taskComments({ ref }))
}

export function qunliUpdateTaskStatus(
  source: RowLessSource,
  ref: string,
  statusId: string
): Promise<QunliMutationResult<QunliTaskDetail>> {
  return call(source, 'updateTaskStatus', { ref, statusId }, () =>
    window.api.qunli.updateTaskStatus({ ref, statusId })
  )
}
