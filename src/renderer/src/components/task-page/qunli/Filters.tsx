import { LoaderCircle, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WorkItemScopePicker } from '@/components/task-page/source-selection/work-item-scope-picker'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { QunliFinishing } from '../../../../../shared/qunli/qunli-types'
import type { TaskPageQunliList } from './use-task-page-qunli-list'

function ScopePicker({
  value,
  onChange,
  label,
  allLabel,
  options
}: {
  value: string | null
  onChange: (value: string | null) => void
  label: string
  allLabel: string
  options: readonly { id: string; name: string }[]
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="min-w-0 max-w-56">
      <WorkItemScopePicker
        options={options.map((option) => ({
          key: option.id,
          value: option.id,
          label: option.name,
          searchText: option.name
        }))}
        selectedKey={value}
        selectedLabel={options.find((option) => option.id === value)?.name}
        onChange={onChange}
        label={label}
        allLabel={allLabel}
        searchPlaceholder={t('taskProviders.qunli.pickerSearch', 'Search')}
        emptyLabel={t('taskProviders.qunli.pickerEmpty', 'Nothing found.')}
      />
    </div>
  )
}

export function TaskPageQunliFilters({ list }: { list: TaskPageQunliList }): React.JSX.Element {
  const t = useTranslate()
  const { filters, setFilters, metadata, loading, refresh } = list
  const assigneeOptions = [
    { id: 'me', name: t('taskProviders.qunli.assigneeMe', 'My cards') },
    ...metadata.members
      .filter((member) => member.active)
      .toSorted((a, b) => Number(a.kind === 'agent') - Number(b.kind === 'agent'))
  ]
  const presets: { id: QunliFinishing; label: string }[] = [
    { id: 'not_finished', label: t('taskProviders.qunli.presetOpen', 'Open') },
    { id: 'finished', label: t('taskProviders.qunli.presetFinished', 'Finished') },
    { id: 'all', label: t('taskProviders.qunli.presetAll', 'All') }
  ]
  return (
    <div className="mt-2 flex-none rounded-md rounded-b-none border border-border/50 bg-muted/50 px-3 pt-2 pb-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ScopePicker
            value={filters.assignee === 'all' ? null : filters.assignee}
            onChange={(assignee) =>
              setFilters((current) => ({ ...current, assignee: assignee ?? 'all' }))
            }
            label={t('taskProviders.qunli.columnAssignee', 'Assignee')}
            allLabel={t('taskProviders.qunli.assigneeAll', 'All members')}
            options={assigneeOptions}
          />
          <ScopePicker
            value={filters.projectId}
            onChange={(projectId) => setFilters((current) => ({ ...current, projectId }))}
            label={t('taskProviders.qunli.columnProject', 'Project')}
            allLabel={t('taskProviders.qunli.allProjects', 'All projects')}
            options={metadata.projects}
          />
          {presets.map((preset) => {
            const active = !filters.hasWorkspace && filters.finishing === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    finishing: preset.id,
                    hasWorkspace: false
                  }))
                }
                className={cn(
                  'rounded-md border px-2 py-1 text-xs transition',
                  active
                    ? 'border-border/50 bg-foreground/90 text-background backdrop-blur-md'
                    : 'border-border/50 bg-transparent text-foreground hover:bg-muted/50'
                )}
              >
                {preset.label}
              </button>
            )
          })}
          <Button
            variant={filters.hasWorkspace ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={filters.hasWorkspace}
            onClick={() =>
              setFilters((current) => ({ ...current, hasWorkspace: !current.hasWorkspace }))
            }
          >
            {t('taskProviders.qunli.hasWorkspace', 'Has Workspace')}
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ScopePicker
            value={filters.typeId}
            onChange={(typeId) => setFilters((current) => ({ ...current, typeId }))}
            label={t('taskProviders.qunli.columnType', 'Type')}
            allLabel={t('taskProviders.qunli.allTypes', 'All types')}
            options={metadata.types}
          />
          <ScopePicker
            value={filters.statusId}
            onChange={(statusId) => setFilters((current) => ({ ...current, statusId }))}
            label={t('taskProviders.qunli.status', 'Status')}
            allLabel={t('taskProviders.qunli.allStatuses', 'All statuses')}
            options={metadata.statuses}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={refresh}
                disabled={loading}
                aria-label={t('taskProviders.qunli.refresh', 'Refresh')}
                className="border-border/50 bg-transparent hover:bg-muted/50 backdrop-blur-md supports-[backdrop-filter]:bg-transparent"
              >
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {t('taskProviders.qunli.refresh', 'Refresh')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="relative mt-3 min-w-[320px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder={t('taskProviders.qunli.searchPlaceholder', 'Search title or T17810')}
          className="h-8 rounded-md border-border/50 bg-background pl-8 pr-8 text-xs"
        />
        {filters.search ? (
          <button
            type="button"
            aria-label={t('taskProviders.qunli.clearSearch', 'Clear search')}
            onClick={() => setFilters((current) => ({ ...current, search: '' }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
