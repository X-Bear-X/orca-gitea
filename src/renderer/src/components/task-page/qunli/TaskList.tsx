import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderGit2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import type { QunliTask } from '../../../../../shared/qunli/qunli-types'
import { formatRelativeTime } from '../task-page-source-context'
import {
  getQunliPriorityTone,
  groupQunliTasksByStatus,
  QUNLI_COLUMNS,
  QUNLI_ROW_GRID,
  qunliColumnLabel,
  type QunliSortColumn,
  type QunliSortDirection
} from './qunli-list-model'
import { qunliStatusPill } from './qunli-status-tone'

export type QunliLinkedWorkspace = { id: string; name: string }

type RowActions = {
  onOpenTask: (task: QunliTask) => void
  onStartWorkspace: (task: QunliTask) => void
  getLinkedWorkspace: (task: QunliTask) => QunliLinkedWorkspace | null
  onOpenWorkspace: (workspace: QunliLinkedWorkspace) => void
}

const MUTED_CELL = 'block truncate text-[12px] text-muted-foreground @max-3xl:!hidden'

export function TaskPageQunliSortHeader({
  sortBy,
  direction,
  onSort
}: {
  sortBy: QunliSortColumn
  direction: QunliSortDirection
  onSort: (column: QunliSortColumn) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div
      className={cn(
        'sticky top-0 z-10 grid h-8 flex-none items-center gap-3 border-b border-border/50 bg-background px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground @max-3xl:!hidden',
        QUNLI_ROW_GRID
      )}
    >
      {QUNLI_COLUMNS.map((column) => (
        <button
          key={column}
          type="button"
          aria-pressed={sortBy === column}
          onClick={() => onSort(column)}
          className="flex items-center gap-1 rounded-sm text-left uppercase select-none hover:text-foreground"
        >
          <span className="truncate">{qunliColumnLabel(column, t)}</span>
          {sortBy === column ? (
            direction === 'asc' ? (
              <ArrowUp aria-hidden="true" className="size-3" />
            ) : (
              <ArrowDown aria-hidden="true" className="size-3" />
            )
          ) : null}
        </button>
      ))}
      <span />
    </div>
  )
}

function StatusPill({ task }: { task: QunliTask }): React.JSX.Element | null {
  const pill = task.status ? qunliStatusPill(task.status) : null
  return task.status && pill ? (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium',
        pill.className
      )}
      style={pill.style}
    >
      <span className="truncate">{task.status.name}</span>
    </span>
  ) : null
}

function TaskRow({
  task,
  selected,
  actions
}: {
  task: QunliTask
  selected: boolean
  actions: RowActions
}): React.JSX.Element {
  const t = useTranslate()
  const workspace = actions.getLinkedWorkspace(task)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      onClick={() => actions.onOpenTask(task)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          actions.onOpenTask(task)
        }
      }}
      className={cn(
        'group/row grid min-h-12 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        QUNLI_ROW_GRID,
        selected && 'bg-accent'
      )}
    >
      <span className="block truncate font-mono text-[12px] text-muted-foreground @max-3xl:!hidden">
        {task.ref}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground @3xl:hidden">
            {task.ref}
          </span>
          <h3 className="min-w-0 truncate text-[13px] font-medium text-foreground">{task.title}</h3>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 @3xl:!hidden">
          <StatusPill task={task} />
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {[task.priority?.name, task.type?.name, task.project?.name].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
      <div className="min-w-0 @max-3xl:!hidden">
        <StatusPill task={task} />
      </div>
      <span
        className={cn(
          'block truncate text-[12px] @max-3xl:!hidden',
          getQunliPriorityTone(task.priority?.name)
        )}
      >
        {task.priority?.name ?? '–'}
      </span>
      <span className={MUTED_CELL}>{task.type?.name ?? '–'}</span>
      <span className={MUTED_CELL}>{task.assignee?.name ?? '–'}</span>
      <span className={MUTED_CELL}>{task.project?.name ?? '–'}</span>
      <span className={MUTED_CELL}>
        {task.updatedAt ? formatRelativeTime(task.updatedAt) : '–'}
      </span>
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(event) => {
                event.stopPropagation()
                if (workspace) {
                  actions.onOpenWorkspace(workspace)
                } else {
                  actions.onStartWorkspace(task)
                }
              }}
              aria-label={
                workspace
                  ? t('taskProviders.qunli.openWorkspace', 'Open workspace')
                  : t('taskProviders.qunli.startWorkspace', 'Start workspace')
              }
            >
              {workspace ? (
                <FolderGit2 className="size-3.5" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {workspace
              ? workspace.name
              : t('taskProviders.qunli.startWorkspace', 'Start workspace')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(event) => {
                event.stopPropagation()
                openAppHttpLink(task.url, { event })
              }}
              aria-label={t('taskProviders.qunli.openInBrowser', 'Open in Qunli')}
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {t('taskProviders.qunli.openInBrowser', 'Open in Qunli')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export function TaskPageQunliTaskList({
  tasks,
  selectedRef,
  ...actions
}: RowActions & {
  tasks: readonly QunliTask[]
  selectedRef: string | null
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const sections = useMemo(() => groupQunliTasksByStatus(tasks), [tasks])
  return (
    <div className="divide-y divide-border/50">
      {sections.map((section) => {
        const open = !collapsed.has(section.key)
        return (
          <Collapsible
            key={section.key}
            open={open}
            onOpenChange={(nextOpen) =>
              setCollapsed((current) => {
                const next = new Set(current)
                if (nextOpen) {
                  next.delete(section.key)
                } else {
                  next.add(section.key)
                }
                return next
              })
            }
          >
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full justify-start rounded-none bg-muted/35 px-3 text-left font-normal transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {open ? (
                  <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                  {section.label}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {section.tasks.length}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="divide-y divide-border/50 border-t border-border/50">
              {section.tasks.map((task) => (
                <TaskRow
                  key={task.ref}
                  task={task}
                  selected={task.ref === selectedRef}
                  actions={actions}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
