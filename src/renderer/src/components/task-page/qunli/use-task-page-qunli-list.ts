import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  QunliAccountMetadata,
  QunliFinishing,
  QunliTask
} from '../../../../../shared/qunli/qunli-types'
import { qunliListTasks, qunliMetadata } from '@/runtime/qunli/runtime-qunli-client'
import { readQunliListPreferences, writeQunliListPreferences } from './qunli-list-preferences'
import { defaultScopeSource } from '@/runtime/hosts/selection/default-creation-host'
import { useAppStore } from '@/store'
import { sortQunliTasks, type QunliSortColumn, type QunliSortDirection } from './qunli-list-model'

const EMPTY_METADATA: QunliAccountMetadata = {
  statuses: [],
  types: [],
  priorities: [],
  projects: [],
  members: []
}

/** 'me' is the agent's manager, 'all' drops the assignee filter. */
export type QunliAssigneeScope = 'me' | 'all' | (string & {})

export type QunliListFilters = {
  assignee: QunliAssigneeScope
  projectId: string | null
  statusId: string | null
  typeId: string | null
  finishing: QunliFinishing
  hasWorkspace: boolean
  search: string
}

const EMPTY_FILTERS: QunliListFilters = {
  assignee: 'me',
  projectId: null,
  statusId: null,
  typeId: null,
  finishing: 'not_finished',
  hasWorkspace: false,
  search: ''
}

function matchesSearch(task: QunliTask, search: string): boolean {
  const needle = search.trim().toLowerCase().replace(/^#/, '')
  if (!needle) {
    return true
  }
  const ref = task.ref.toLowerCase()
  return ref === needle || ref === `t${needle}` || task.title.toLowerCase().includes(needle)
}

export function useTaskPageQunliList(
  enabled: boolean,
  hasLinkedWorkspace: (task: QunliTask) => boolean
) {
  const settings = useAppStore((s) => s.settings)
  const viewerKey = useAppStore((s) => {
    const viewer = s.qunliStatus.viewer
    return viewer ? `${viewer.accountId}:${viewer.managerId ?? ''}` : null
  })
  const [metadata, setMetadata] = useState<QunliAccountMetadata>(EMPTY_METADATA)
  const [tasks, setTasks] = useState<QunliTask[]>([])
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialPreferences] = useState(readQunliListPreferences)
  const [filters, setFilters] = useState<QunliListFilters>(() => ({
    ...EMPTY_FILTERS,
    assignee: initialPreferences.assignee,
    projectId: initialPreferences.projectId,
    statusId: initialPreferences.statusId,
    typeId: initialPreferences.typeId,
    finishing: initialPreferences.finishing,
    hasWorkspace: initialPreferences.hasWorkspace
  }))
  const [sortBy, setSortBy] = useState<QunliSortColumn>(initialPreferences.sortBy)
  const [sortDirection, setSortDirection] = useState<QunliSortDirection>(
    initialPreferences.sortDirection
  )
  const [refreshNonce, setRefreshNonce] = useState(0)

  const { assignee, projectId, statusId, typeId, finishing, hasWorkspace } = filters
  useEffect(() => {
    writeQunliListPreferences({
      assignee,
      projectId,
      statusId,
      typeId,
      finishing,
      hasWorkspace,
      sortBy,
      sortDirection
    })
  }, [assignee, finishing, hasWorkspace, projectId, sortBy, sortDirection, statusId, typeId])
  useEffect(() => {
    if (!enabled || !viewerKey) {
      return
    }
    let cancelled = false
    const source = defaultScopeSource(settings)
    setLoading(true)
    setError(null)
    Promise.all([
      qunliMetadata(source, refreshNonce > 0),
      qunliListTasks(source, {
        ...(assignee === 'me' ? {} : { assigneeId: assignee === 'all' ? null : assignee }),
        projectId,
        statusId,
        typeId,
        finishing
      })
    ])
      .then(([nextMetadata, page]) => {
        if (!cancelled) {
          setMetadata(nextMetadata)
          setTasks(page.tasks)
          setTotal(page.total)
          setTruncated(page.truncated)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [assignee, enabled, finishing, projectId, refreshNonce, settings, statusId, typeId, viewerKey])

  const displayedTasks = useMemo(
    () =>
      sortQunliTasks(
        tasks.filter(
          (task) =>
            matchesSearch(task, filters.search) &&
            (!filters.hasWorkspace || hasLinkedWorkspace(task))
        ),
        sortBy,
        sortDirection
      ),
    [filters.hasWorkspace, filters.search, hasLinkedWorkspace, sortBy, sortDirection, tasks]
  )

  const sort = useCallback(
    (column: QunliSortColumn) => {
      if (column === sortBy) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(column)
        setSortDirection(column === 'updated' ? 'desc' : 'asc')
      }
    },
    [sortBy]
  )

  const replaceTask = useCallback((task: QunliTask) => {
    setTasks((current) => current.map((entry) => (entry.ref === task.ref ? task : entry)))
  }, [])

  return {
    metadata,
    tasks,
    total,
    truncated,
    displayedTasks,
    loading,
    error,
    filters,
    setFilters,
    sortBy,
    sortDirection,
    sort,
    refresh: () => setRefreshNonce((value) => value + 1),
    replaceTask
  }
}

export type TaskPageQunliList = ReturnType<typeof useTaskPageQunliList>
