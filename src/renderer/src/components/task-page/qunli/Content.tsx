import { useCallback, useEffect, useMemo, useState } from 'react'
import { Columns3, List, LoaderCircle } from 'lucide-react'
import { QunliIcon } from '@/components/icons/QunliIcon'
import { QunliConnectDialog } from '@/components/qunli-connect-dialog'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTranslate } from '@/i18n/use-translate'
import { getProviderRuntimeContextKey } from '@/runtime/hosts/observations/provider-runtime-context'
import { useAppStore } from '@/store'
import type { QunliTask } from '../../../../../shared/qunli/qunli-types'
import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
import { qunliBoardStatuses, TaskPageQunliBoard } from './Board'
import { TaskPageQunliFilters } from './Filters'
import { TaskPageQunliSortHeader, TaskPageQunliTaskList } from './TaskList'
import { TaskPageQunliTaskSheet } from './TaskSheet'
import { useTaskPageQunliList } from './use-task-page-qunli-list'
import { useQunliWorkspaceActions } from './use-qunli-workspace-actions'
import { useQunliTaskMove } from './use-qunli-task-move'

const VIEW_STORAGE_KEY = 'orca.qunli.view-mode.v1'

function readViewMode(): 'list' | 'board' {
  return localStorage.getItem(VIEW_STORAGE_KEY) === 'board' ? 'board' : 'list'
}

export function TaskPageQunliContent({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const t = useTranslate()
  const settings = useAppStore((s) => s.settings)
  const qunliStatus = useAppStore((s) => s.qunliStatus)
  const qunliStatusChecked = useAppStore((s) => s.qunliStatusChecked)
  const qunliStatusContextKey = useAppStore((s) => s.qunliStatusContextKey)
  const [connectOpen, setConnectOpen] = useState(false)
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState(readViewMode)
  const checkQunliConnection = useAppStore((s) => s.checkQunliConnection)
  const statusCurrent = qunliStatusContextKey === getProviderRuntimeContextKey(settings)
  const ready = qunliStatusChecked && statusCurrent
  useEffect(() => {
    if (!ready) {
      void checkQunliConnection()
    }
  }, [checkQunliConnection, ready])
  const connected = ready && qunliStatus.connected && qunliStatus.viewer !== null
  const { startWorkspace, getLinkedWorkspace, openWorkspace } = useQunliWorkspaceActions(model)
  const hasLinkedWorkspace = useCallback(
    (task: QunliTask) => getLinkedWorkspace(task) !== null,
    [getLinkedWorkspace]
  )
  const list = useTaskPageQunliList(connected, hasLinkedWorkspace)
  const moveTask = useQunliTaskMove(list)
  const boardStatuses = useMemo(
    () => qunliBoardStatuses(list.metadata, list.displayedTasks, list.filters),
    [list.displayedTasks, list.filters, list.metadata]
  )
  const selectedTask = useMemo(
    () => list.tasks.find((task) => task.ref === selectedRef) ?? null,
    [list.tasks, selectedRef]
  )

  const viewer = qunliStatus.viewer
  const assignee = list.filters.assignee
  const listTitle =
    assignee === 'all'
      ? t('taskProviders.qunli.listTitleAll', 'Cards of all members')
      : t('taskProviders.qunli.listTitle', 'Cards of {{name}}', {
          name:
            assignee === 'me'
              ? (viewer?.managerName ?? viewer?.agentName ?? '')
              : (list.metadata.members.find((member) => member.id === assignee)?.name ?? '')
        })

  if (!ready) {
    return (
      <div className="mt-4 flex items-center justify-center py-14">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-border/50 bg-muted/50 px-6 py-14 text-center shadow-sm">
        <QunliIcon className="mb-4 size-8 text-muted-foreground/60" />
        <p className="text-base font-medium text-foreground">
          {t('taskProviders.qunli.connectTitle', 'Connect Qunli')}
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {qunliStatus.credentialError ??
            t(
              'taskProviders.qunli.emptyDescription',
              'Browse the Qunli cards assigned to you and start workspaces from them.'
            )}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => setConnectOpen(true)}>
            {t('taskProviders.qunli.addAccess', 'Add Qunli access')}
          </Button>
          <Button variant="outline" onClick={() => model.hideTaskSource('qunli', 'Qunli')}>
            {t('taskProviders.qunli.hide', 'Hide Qunli')}
          </Button>
        </div>
        <QunliConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
      </div>
    )
  }

  return (
    <>
      <TaskPageQunliFilters list={list} />
      <div className="@container flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-background shadow-sm">
        <div className="flex min-h-10 flex-none flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/35 px-3 py-1">
          <div className="min-w-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {listTitle}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-2xs text-muted-foreground">
              {list.truncated
                ? t('taskProviders.qunli.truncatedCount', '{{count}} of {{total}} shown', {
                    count: list.displayedTasks.length,
                    total: list.total
                  })
                : t('taskProviders.qunli.shownCount', '{{count}} shown', {
                    count: list.displayedTasks.length
                  })}
            </span>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => {
                if (value === 'list' || value === 'board') {
                  setViewMode(value)
                  localStorage.setItem(VIEW_STORAGE_KEY, value)
                }
              }}
              aria-label={t('taskProviders.qunli.viewMode', 'Qunli view')}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="list">
                <List />
                {t('taskProviders.qunli.viewList', 'List')}
              </ToggleGroupItem>
              <ToggleGroupItem value="board">
                <Columns3 />
                {t('taskProviders.qunli.viewBoard', 'Board')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        {list.truncated ? (
          <div className="flex-none border-b border-border/50 px-3 py-1.5 text-[12px] text-muted-foreground">
            {t(
              'taskProviders.qunli.truncatedHint',
              'Only the first cards are loaded. Pick a project or status to narrow the list.'
            )}
          </div>
        ) : null}
        {list.error ? (
          <div className="flex-none border-b border-border px-4 py-4 text-sm text-destructive">
            {list.error}
          </div>
        ) : null}
        {viewMode === 'board' ? (
          <TaskPageQunliBoard
            tasks={list.displayedTasks}
            statuses={boardStatuses}
            metadata={list.metadata}
            onOpenTask={(task) => setSelectedRef(task.ref)}
            onStartWorkspace={startWorkspace}
            getLinkedWorkspace={getLinkedWorkspace}
            onOpenWorkspace={openWorkspace}
            onMoveTask={(task, statusId) => void moveTask(task, statusId)}
          />
        ) : (
          <div
            className="min-h-0 flex-1 overflow-auto scrollbar-sleek"
            style={{ scrollbarGutter: 'stable' }}
          >
            <TaskPageQunliSortHeader
              sortBy={list.sortBy}
              direction={list.sortDirection}
              onSort={list.sort}
            />
            {list.loading && list.tasks.length === 0 ? (
              <div className="divide-y divide-border/50">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="px-3 py-3">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-muted/70" />
                    <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-muted/60" />
                  </div>
                ))}
              </div>
            ) : null}
            {!list.loading && !list.error && list.displayedTasks.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t('taskProviders.qunli.emptyTitle', 'No cards found')}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('taskProviders.qunli.empty', 'No cards match these filters.')}
                </p>
              </div>
            ) : null}
            <TaskPageQunliTaskList
              tasks={list.displayedTasks}
              selectedRef={selectedRef}
              onOpenTask={(task) => setSelectedRef(task.ref)}
              onStartWorkspace={startWorkspace}
              getLinkedWorkspace={getLinkedWorkspace}
              onOpenWorkspace={openWorkspace}
            />
          </div>
        )}
      </div>
      <TaskPageQunliTaskSheet
        task={selectedTask}
        metadata={list.metadata}
        onClose={() => setSelectedRef(null)}
        onStartWorkspace={startWorkspace}
        onTaskChanged={list.replaceTask}
      />
    </>
  )
}
