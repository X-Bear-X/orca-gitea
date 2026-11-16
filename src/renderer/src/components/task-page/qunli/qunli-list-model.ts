import type { QunliTask } from '../../../../../shared/qunli/qunli-types'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'

export type QunliSortColumn =
  | 'ref'
  | 'title'
  | 'status'
  | 'priority'
  | 'type'
  | 'assignee'
  | 'project'
  | 'updated'
export type QunliSortDirection = 'asc' | 'desc'
export type QunliTaskSection = { key: string; label: string; stage: string; tasks: QunliTask[] }

export const QUNLI_COLUMNS: readonly QunliSortColumn[] = [
  'ref',
  'title',
  'status',
  'priority',
  'type',
  'assignee',
  'project',
  'updated'
]

/** Key, title, status, priority, type, assignee, project, updated, actions. */
export const QUNLI_ROW_GRID =
  '@3xl:grid-cols-[84px_minmax(180px,1fr)_120px_72px_88px_104px_minmax(88px,132px)_80px_76px]'

export function qunliColumnLabel(column: QunliSortColumn, t: Translate = translate): string {
  switch (column) {
    case 'ref':
      return t('taskProviders.qunli.columnRef', 'Card')
    case 'title':
      return t('taskProviders.qunli.columnTitle', 'Title')
    case 'status':
      return t('taskProviders.qunli.status', 'Status')
    case 'priority':
      return t('taskProviders.qunli.columnPriority', 'Priority')
    case 'type':
      return t('taskProviders.qunli.columnType', 'Type')
    case 'assignee':
      return t('taskProviders.qunli.columnAssignee', 'Assignee')
    case 'project':
      return t('taskProviders.qunli.columnProject', 'Project')
    case 'updated':
      return t('taskProviders.qunli.columnUpdated', 'Updated')
  }
}

function refNumber(task: QunliTask): number {
  return Number(task.ref.replace(/^T/i, '')) || 0
}

function compareTasks(a: QunliTask, b: QunliTask, column: QunliSortColumn): number {
  switch (column) {
    case 'ref':
      return refNumber(a) - refNumber(b)
    case 'title':
      return a.title.localeCompare(b.title)
    case 'status':
      return (a.status?.position ?? 0) - (b.status?.position ?? 0)
    case 'priority':
      return (a.priority?.position ?? 99) - (b.priority?.position ?? 99)
    case 'type':
      return (a.type?.name ?? '').localeCompare(b.type?.name ?? '')
    case 'assignee':
      return (a.assignee?.name ?? '').localeCompare(b.assignee?.name ?? '')
    case 'project':
      return (a.project?.name ?? '').localeCompare(b.project?.name ?? '')
    case 'updated':
      return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '')
  }
}

export function sortQunliTasks(
  tasks: readonly QunliTask[],
  column: QunliSortColumn,
  direction: QunliSortDirection
): QunliTask[] {
  const sorted = tasks.toSorted((a, b) => compareTasks(a, b, column) || refNumber(b) - refNumber(a))
  return direction === 'desc' ? sorted.toReversed() : sorted
}

/** Sections follow the team's status order, like the Qunli board columns. */
export function groupQunliTasksByStatus(tasks: readonly QunliTask[]): QunliTaskSection[] {
  const sections = new Map<string, QunliTaskSection & { position: number }>()
  for (const task of tasks) {
    const key = task.status?.id ?? 'none'
    const section = sections.get(key)
    if (section) {
      section.tasks.push(task)
    } else {
      sections.set(key, {
        key,
        label: task.status?.name ?? '–',
        stage: task.status?.stage ?? 'todo',
        position: task.status?.position ?? Number.MAX_SAFE_INTEGER,
        tasks: [task]
      })
    }
  }
  return [...sections.values()].toSorted((a, b) => a.position - b.position)
}

const PRIORITY_TONES: readonly { tone: string; pattern: RegExp }[] = [
  { tone: 'text-jira-priority-high', pattern: /紧急|最高|高|urgent|highest|high|critical|p0|p1/i },
  { tone: 'text-jira-priority-medium', pattern: /中|普通|medium|normal|p2/i },
  { tone: 'text-jira-priority-low', pattern: /低|low|minor|p3|p4/i }
]

export function getQunliPriorityTone(name: string | undefined): string {
  return (
    PRIORITY_TONES.find((entry) => entry.pattern.test(name ?? ''))?.tone ?? 'text-muted-foreground'
  )
}
