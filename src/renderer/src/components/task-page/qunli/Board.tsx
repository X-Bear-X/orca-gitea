import { useMemo, useState } from 'react'
import { ArrowRight, FolderGit2, MessageSquare } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type {
  QunliAccountMetadata,
  QunliFinishing,
  QunliTask,
  QunliTaskStatus
} from '../../../../../shared/qunli/qunli-types'
import { allowedQunliStatuses } from './qunli-task-status-control'
import { qunliDotStyle, qunliTintStyle } from './qunli-colors'
import type { QunliLinkedWorkspace } from './TaskList'

const FINISHED_STAGES = new Set(['completed', 'cancelled'])

export function qunliBoardStatuses(
  metadata: QunliAccountMetadata,
  tasks: readonly QunliTask[],
  filters: { typeId: string | null; statusId: string | null; finishing: QunliFinishing }
): QunliTaskStatus[] {
  const typeStatusIds = metadata.types.find((type) => type.id === filters.typeId)?.statusIds
  const used = new Set(tasks.flatMap((task) => (task.status ? [task.status.id] : [])))
  return metadata.statuses.filter((status) => {
    if (used.has(status.id)) {
      return true
    }
    if (filters.statusId) {
      return status.id === filters.statusId
    }
    if (typeStatusIds?.length && !typeStatusIds.includes(status.id)) {
      return false
    }
    const finished = FINISHED_STAGES.has(status.stage)
    return filters.finishing === 'all' || (filters.finishing === 'finished') === finished
  })
}

function Avatar({ task }: { task: QunliTask }): React.JSX.Element | null {
  const assignee = task.assignee
  if (!assignee) {
    return null
  }
  return assignee.avatarUrl ? (
    <img
      src={assignee.avatarUrl}
      alt=""
      title={assignee.name}
      className="ml-auto size-6 shrink-0 rounded-full border border-border/50"
    />
  ) : (
    <span
      title={assignee.name}
      className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground"
    >
      {assignee.name.slice(0, 1)}
    </span>
  )
}

function BoardCard({
  task,
  onOpenTask,
  onStartWorkspace,
  workspace,
  onOpenWorkspace,
  onDragStart
}: {
  task: QunliTask
  onOpenTask: (task: QunliTask) => void
  onStartWorkspace: (task: QunliTask) => void
  workspace: QunliLinkedWorkspace | null
  onOpenWorkspace: (workspace: QunliLinkedWorkspace) => void
  onDragStart: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', task.ref)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onClick={() => onOpenTask(task)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onOpenTask(task)
        }
      }}
      className="group/card cursor-pointer rounded-lg border border-border/60 bg-background px-3 py-2.5 shadow-xs transition hover:border-border hover:shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <p className="line-clamp-3 text-[13px] font-medium leading-snug text-foreground">
        {task.title}
      </p>
      <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="shrink-0 font-mono">#{task.ref}</span>
        {task.type ? (
          <span
            className="truncate rounded-md bg-muted px-1.5 py-0.5 text-foreground"
            style={qunliTintStyle(task.type.color)}
          >
            {task.type.name}
          </span>
        ) : null}
        {task.priority ? (
          <span
            className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-foreground"
            style={qunliTintStyle(task.priority.color)}
          >
            {task.priority.name}
          </span>
        ) : null}
        {task.commentsCount > 0 ? (
          <span className="flex shrink-0 items-center gap-0.5">
            <MessageSquare className="size-3" />
            {task.commentsCount}
          </span>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (workspace) {
              onOpenWorkspace(workspace)
            } else {
              onStartWorkspace(task)
            }
          }}
          title={workspace?.name ?? t('taskProviders.qunli.startWorkspace', 'Start workspace')}
          aria-label={
            workspace
              ? t('taskProviders.qunli.openWorkspace', 'Open workspace')
              : t('taskProviders.qunli.startWorkspace', 'Start workspace')
          }
          className={cn(
            'shrink-0 rounded p-0.5 transition hover:bg-accent hover:text-foreground',
            !workspace && 'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100'
          )}
        >
          {workspace ? <FolderGit2 className="size-3.5" /> : <ArrowRight className="size-3.5" />}
        </button>
        <Avatar task={task} />
      </div>
    </div>
  )
}

export function TaskPageQunliBoard({
  tasks,
  statuses,
  metadata,
  onOpenTask,
  onStartWorkspace,
  getLinkedWorkspace,
  onOpenWorkspace,
  onMoveTask
}: {
  tasks: readonly QunliTask[]
  statuses: readonly QunliTaskStatus[]
  metadata: QunliAccountMetadata
  onOpenTask: (task: QunliTask) => void
  onStartWorkspace: (task: QunliTask) => void
  getLinkedWorkspace: (task: QunliTask) => QunliLinkedWorkspace | null
  onOpenWorkspace: (workspace: QunliLinkedWorkspace) => void
  onMoveTask: (task: QunliTask, statusId: string) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [dragging, setDragging] = useState<QunliTask | null>(null)
  const [overStatusId, setOverStatusId] = useState<string | null>(null)
  const byStatus = useMemo(() => {
    const map = new Map<string, QunliTask[]>()
    for (const task of tasks) {
      const key = task.status?.id ?? ''
      map.set(key, [...(map.get(key) ?? []), task])
    }
    return map
  }, [tasks])
  const allowedTargets = useMemo(
    () =>
      new Set(dragging ? allowedQunliStatuses(dragging, metadata).map((status) => status.id) : []),
    [dragging, metadata]
  )

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 scrollbar-sleek">
      {statuses.map((status) => {
        const columnTasks = byStatus.get(status.id) ?? []
        const droppable = dragging !== null && dragging.status?.id !== status.id
        const allowed = droppable && allowedTargets.has(status.id)
        return (
          <section
            key={status.id}
            onDragOver={(event) => {
              if (allowed) {
                event.preventDefault()
                setOverStatusId(status.id)
              }
            }}
            onDragLeave={() =>
              setOverStatusId((current) => (current === status.id ? null : current))
            }
            onDrop={(event) => {
              event.preventDefault()
              if (dragging && allowed) {
                onMoveTask(dragging, status.id)
              }
              setDragging(null)
              setOverStatusId(null)
            }}
            className={cn(
              'flex max-h-full w-72 shrink-0 flex-col rounded-lg bg-muted/50 transition',
              droppable && !allowed && 'opacity-50',
              overStatusId === status.id && 'ring-2 ring-ring/50'
            )}
          >
            <header className="flex flex-none items-center gap-2 px-3 pt-2.5 pb-2">
              <span
                className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-foreground"
                style={qunliTintStyle(status.color)}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full bg-muted-foreground"
                  style={qunliDotStyle(status.color)}
                />
                <span className="truncate">{status.name}</span>
              </span>
              <span className="text-[12px] text-muted-foreground">{columnTasks.length}</span>
            </header>
            <div
              className="flex min-h-16 flex-col gap-2 overflow-y-auto px-2 pb-2 scrollbar-sleek"
              onDragEnd={() => {
                setDragging(null)
                setOverStatusId(null)
              }}
            >
              {columnTasks.map((task) => (
                <BoardCard
                  key={task.ref}
                  task={task}
                  onOpenTask={onOpenTask}
                  onStartWorkspace={onStartWorkspace}
                  workspace={getLinkedWorkspace(task)}
                  onOpenWorkspace={onOpenWorkspace}
                  onDragStart={() => setDragging(task)}
                />
              ))}
              {columnTasks.length === 0 ? (
                <p className="px-1 py-3 text-center text-[12px] text-muted-foreground/70">
                  {t('taskProviders.qunli.boardEmptyColumn', 'No cards')}
                </p>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
