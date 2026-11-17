import type { QunliFinishing } from '../../../../../shared/qunli/qunli-types'
import { QUNLI_COLUMNS, type QunliSortColumn, type QunliSortDirection } from './qunli-list-model'

// Device-local, like the Jira list columns and view mode.
const STORAGE_KEY = 'orca.qunli.list-preferences.v1'

export type QunliListPreferences = {
  assignee: string
  projectId: string | null
  statusId: string | null
  typeId: string | null
  finishing: QunliFinishing
  hasWorkspace: boolean
  sortBy: QunliSortColumn
  sortDirection: QunliSortDirection
}

export const DEFAULT_QUNLI_LIST_PREFERENCES: QunliListPreferences = {
  assignee: 'me',
  projectId: null,
  statusId: null,
  typeId: null,
  finishing: 'not_finished',
  hasWorkspace: false,
  sortBy: 'updated',
  sortDirection: 'desc'
}

function idOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function isSortColumn(value: unknown): value is QunliSortColumn {
  return QUNLI_COLUMNS.some((column) => column === value)
}

export function readQunliListPreferences(): QunliListPreferences {
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return DEFAULT_QUNLI_LIST_PREFERENCES
  }
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_QUNLI_LIST_PREFERENCES
  }
  const record: Record<string, unknown> = { ...raw }
  const finishing = record.finishing
  return {
    assignee: idOrNull(record.assignee) ?? 'me',
    projectId: idOrNull(record.projectId),
    statusId: idOrNull(record.statusId),
    typeId: idOrNull(record.typeId),
    finishing: finishing === 'finished' || finishing === 'all' ? finishing : 'not_finished',
    hasWorkspace: record.hasWorkspace === true,
    sortBy: isSortColumn(record.sortBy) ? record.sortBy : 'updated',
    sortDirection: record.sortDirection === 'asc' ? 'asc' : 'desc'
  }
}

export function writeQunliListPreferences(preferences: QunliListPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Storage can be full or disabled; the filters still work for this session.
  }
}
