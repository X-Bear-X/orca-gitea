import { taskProviderFailure } from '../../shared/work-items/task-provider-failure'
import type {
  QunliAccountMetadata,
  QunliComment,
  QunliMutationResult,
  QunliTaskDetail,
  QunliTaskListFilter,
  QunliTaskPage,
  QunliViewer
} from '../../shared/qunli/qunli-types'
import { getQunliApiKey, getQunliViewer } from './client'
import { mapAccountMetadata, mapComment, mapTask, mapTaskDetail } from './qunli-mappers'
import { qunliRequest, qunliRequestPage } from './qunli-request'

const METADATA_TTL_MS = 5 * 60_000
const PAGE_LIMIT = 100
const MAX_PAGES = 5

let metadataCache: { accountId: string; loadedAt: number; value: QunliAccountMetadata } | null =
  null

type QunliSession = { apiKey: string; viewer: QunliViewer }

async function requireSession(): Promise<QunliSession> {
  const apiKey = getQunliApiKey()
  const viewer = apiKey ? await getQunliViewer() : null
  if (!apiKey || !viewer) {
    throw new Error('Not connected to Qunli.')
  }
  return { apiKey, viewer }
}

function accountPath(viewer: QunliViewer, path: string): string {
  return `/accounts/${encodeURIComponent(viewer.accountId)}${path}`
}

async function loadMetadata(
  session: QunliSession,
  options: { force?: boolean } = {}
): Promise<QunliAccountMetadata> {
  const { apiKey, viewer } = session
  if (
    !options.force &&
    metadataCache?.accountId === viewer.accountId &&
    Date.now() - metadataCache.loadedAt < METADATA_TTL_MS
  ) {
    return metadataCache.value
  }
  const [account, projects, members] = await Promise.all([
    qunliRequest(apiKey, accountPath(viewer, '')),
    qunliRequest(apiKey, accountPath(viewer, '/projects'), { searchParams: { status: 'active' } }),
    qunliRequest(apiKey, accountPath(viewer, '/users'))
  ])
  const value = mapAccountMetadata(account, projects, members)
  metadataCache = { accountId: viewer.accountId, loadedAt: Date.now(), value }
  return value
}

export async function getMetadata(
  options: { force?: boolean } = {}
): Promise<QunliAccountMetadata> {
  return loadMetadata(await requireSession(), options)
}

export async function listTasks(filter: QunliTaskListFilter = {}): Promise<QunliTaskPage> {
  const session = await requireSession()
  const metadata = await loadMetadata(session)
  const assigneeId = filter.assigneeId === undefined ? session.viewer.managerId : filter.assigneeId
  const readPage = (page: number) =>
    qunliRequestPage(session.apiKey, accountPath(session.viewer, '/tasks'), {
      searchParams: {
        page,
        limit: PAGE_LIMIT,
        assignee_id: assigneeId,
        project_ids: filter.projectId,
        task_status_id: filter.statusId,
        task_type_id: filter.typeId,
        finishing: filter.finishing === 'all' ? undefined : (filter.finishing ?? 'not_finished')
      }
    })
  const first = await readPage(1)
  const totalPages = typeof first.meta?.total_pages === 'number' ? first.meta.total_pages : 1
  const rest = await Promise.all(
    Array.from({ length: Math.min(totalPages, MAX_PAGES) - 1 }, (_, index) => readPage(index + 2))
  )
  const tasks = [first, ...rest].flatMap((page) =>
    (Array.isArray(page.data) ? page.data : []).flatMap(
      (row) => mapTask(row, metadata, session.viewer.accountId) ?? []
    )
  )
  const total = typeof first.meta?.total === 'number' ? first.meta.total : tasks.length
  return { tasks, total, truncated: totalPages > MAX_PAGES }
}

export async function getTask(ref: string): Promise<QunliTaskDetail | null> {
  const session = await requireSession()
  const metadata = await loadMetadata(session)
  const raw = await qunliRequest(
    session.apiKey,
    accountPath(session.viewer, `/tasks/${encodeURIComponent(ref)}`)
  )
  return mapTaskDetail(raw, metadata, session.viewer.accountId)
}

export async function listComments(ref: string): Promise<QunliComment[]> {
  const session = await requireSession()
  const metadata = await loadMetadata(session)
  const raw = await qunliRequest(
    session.apiKey,
    accountPath(session.viewer, `/recordings/${encodeURIComponent(ref)}/comments`)
  )
  return (Array.isArray(raw) ? raw : []).flatMap((comment) => mapComment(comment, metadata) ?? [])
}

export async function updateTaskStatus(
  ref: string,
  statusId: string
): Promise<QunliMutationResult<QunliTaskDetail>> {
  try {
    const session = await requireSession()
    const metadata = await loadMetadata(session)
    const current = await getTask(ref)
    const allowed = current?.type?.statusIds ?? []
    if (allowed.length > 0 && !allowed.includes(statusId)) {
      return taskProviderFailure(
        'qunli.statusNotAllowed',
        'This task type cannot move to that status.'
      )
    }
    const raw = await qunliRequest(
      session.apiKey,
      accountPath(session.viewer, `/tasks/${encodeURIComponent(ref)}`),
      { method: 'PATCH', body: { task: { task_status_id: statusId } } }
    )
    const value = mapTaskDetail(raw, metadata, session.viewer.accountId)
    return value
      ? { ok: true, value }
      : taskProviderFailure('qunli.updateFailed', 'Failed to update the Qunli task.')
  } catch (error) {
    return error instanceof Error
      ? { ok: false, error: error.message }
      : taskProviderFailure('qunli.updateFailed', 'Failed to update the Qunli task.')
  }
}

export function _resetQunliMetadataCache(): void {
  metadataCache = null
}
