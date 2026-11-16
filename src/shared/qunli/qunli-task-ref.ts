import type { QunliTaskListFilter } from './qunli-types'

export const QUNLI_TASK_REF_PATTERN = /^T\d+$/i

export function normalizeQunliTaskRef(value: unknown): string {
  if (typeof value !== 'string' || !QUNLI_TASK_REF_PATTERN.test(value.trim())) {
    throw new Error('A Qunli task ref such as T17810 is required.')
  }
  return value.trim().toUpperCase()
}

function optionalId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function normalizeQunliTaskListFilter(value: unknown): QunliTaskListFilter {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const record: Record<string, unknown> = { ...value }
  return {
    // Omitted means "my tasks"; an explicit null lists every assignee.
    ...(record.assigneeId !== undefined ? { assigneeId: optionalId(record.assigneeId) } : {}),
    projectId: optionalId(record.projectId),
    statusId: optionalId(record.statusId),
    typeId: optionalId(record.typeId),
    finishing:
      record.finishing === 'finished' || record.finishing === 'all'
        ? record.finishing
        : 'not_finished'
  }
}

export const QUNLI_ORIGIN = 'https://qunli.co'
const QUNLI_HOST = 'qunli.co'

export function qunliTaskUrl(accountId: string, ref: string): string {
  return `${QUNLI_ORIGIN}/${encodeURIComponent(accountId)}/${encodeURIComponent(ref)}`
}

/** Card links look like https://qunli.co/2025/T17810. */
export function parseQunliTaskUrl(href: string): { accountId: string; ref: string } | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.hostname !== QUNLI_HOST && url.hostname !== `www.${QUNLI_HOST}`) {
    return null
  }
  const match = /^\/([^/]+)\/(T\d+)\/?$/i.exec(url.pathname)
  return match ? { accountId: decodeURIComponent(match[1]), ref: match[2].toUpperCase() } : null
}
