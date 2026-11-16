import { useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type {
  QunliAccountMetadata,
  QunliTask,
  QunliTaskStatus
} from '../../../../../shared/qunli/qunli-types'
import { qunliStatusPill } from './qunli-status-tone'

export function allowedQunliStatuses(
  task: QunliTask,
  metadata: QunliAccountMetadata
): QunliTaskStatus[] {
  const allowed = task.type?.statusIds ?? []
  return allowed.length > 0
    ? metadata.statuses.filter((status) => allowed.includes(status.id))
    : metadata.statuses
}

export function QunliTaskStatusControl({
  task,
  metadata,
  pending,
  onChange
}: {
  task: QunliTask
  metadata: QunliAccountMetadata
  pending: boolean
  onChange: (statusId: string) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          aria-label={t('taskProviders.qunli.changeStatus', 'Change status: {{status}}', {
            status: task.status?.name ?? ''
          })}
        >
          {task.status?.name ?? t('taskProviders.qunli.status', 'Status')}
          {pending ? (
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {allowedQunliStatuses(task, metadata).map((status) => (
          <button
            key={status.id}
            type="button"
            onClick={() => {
              setOpen(false)
              if (status.id !== task.status?.id) {
                onChange(status.id)
              }
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
          >
            <span
              className={cn(
                'inline-flex min-w-0 items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium',
                qunliStatusPill(status).className
              )}
              style={qunliStatusPill(status).style}
            >
              <span className="truncate">{status.name}</span>
            </span>
            {status.id === task.status?.id ? <Check className="ml-auto size-3.5" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
