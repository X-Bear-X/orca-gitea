import { useState } from 'react'
import * as VisuallyHidden from 'radix-ui/visually-hidden'
import { ArrowRight, Copy, ExternalLink, Hash, LoaderCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { QunliIcon } from '@/components/icons/QunliIcon'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { taskProviderErrorMessage } from '@/lib/work-items/task-provider-error-copy'
import { qunliUpdateTaskStatus } from '@/runtime/qunli/runtime-qunli-client'
import { defaultScopeSource } from '@/runtime/hosts/selection/default-creation-host'
import { useAppStore } from '@/store'
import type { QunliAccountMetadata, QunliTask } from '../../../../../shared/qunli/qunli-types'
import { formatRelativeTime } from '../task-page-source-context'
import { getQunliPriorityTone } from './qunli-list-model'
import { QunliTaskStatusControl } from './qunli-task-status-control'
import { QunliTaskSheetBody } from './TaskSheetBody'
import { useQunliTaskDetail } from './use-qunli-task-detail'

export function TaskPageQunliTaskSheet({
  task,
  metadata,
  onClose,
  onStartWorkspace,
  onTaskChanged
}: {
  task: QunliTask | null
  metadata: QunliAccountMetadata
  onClose: () => void
  onStartWorkspace: (task: QunliTask) => void
  onTaskChanged: (task: QunliTask) => void
}): React.JSX.Element {
  const t = useTranslate()
  const settings = useAppStore((s) => s.settings)
  const detailState = useQunliTaskDetail(task?.ref ?? null)
  const [savingStatus, setSavingStatus] = useState(false)
  const displayed = detailState.detail ?? task

  const changeStatus = async (statusId: string): Promise<void> => {
    if (!displayed) {
      return
    }
    setSavingStatus(true)
    try {
      const result = await qunliUpdateTaskStatus(
        defaultScopeSource(settings),
        displayed.ref,
        statusId
      )
      if (result.ok) {
        detailState.setDetail(result.value)
        onTaskChanged(result.value)
      } else {
        toast.error(taskProviderErrorMessage(result))
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSavingStatus(false)
    }
  }

  const actions = displayed
    ? [
        {
          label: t('taskProviders.qunli.openInBrowser', 'Open in Qunli'),
          icon: ExternalLink,
          action: () => openAppHttpLink(displayed.url)
        },
        {
          label: t('taskProviders.qunli.copyLink', 'Copy link'),
          icon: Copy,
          action: () => void window.api.ui.writeClipboardText(displayed.url)
        },
        {
          label: t('taskProviders.qunli.copyRef', 'Copy card number'),
          icon: Hash,
          action: () => void window.api.ui.writeClipboardText(displayed.ref)
        }
      ]
    : []

  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(92vw,780px)] p-0 sm:max-w-[780px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <VisuallyHidden.Root asChild>
          <SheetTitle>{displayed?.title ?? t('taskProviders.qunli.name', 'Qunli')}</SheetTitle>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <SheetDescription>
            {t('taskProviders.qunli.sheetDescription', 'Preview and start work from the card.')}
          </SheetDescription>
        </VisuallyHidden.Root>
        {displayed ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="flex-none border-b border-border/50 bg-muted/30 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{displayed.ref}</span>
                    {displayed.project ? <span>{displayed.project.name}</span> : null}
                    {displayed.updatedAt ? (
                      <span>{formatRelativeTime(displayed.updatedAt)}</span>
                    ) : null}
                    {detailState.loading ? <LoaderCircle className="size-3 animate-spin" /> : null}
                  </div>
                  <h2 className="mt-1 text-[20px] font-semibold leading-tight text-foreground">
                    {displayed.title}
                  </h2>
                </div>
                <Button
                  onClick={() => onStartWorkspace(displayed)}
                  className="hidden shrink-0 gap-2 sm:inline-flex"
                  size="sm"
                >
                  {t('taskProviders.qunli.startWorkspace', 'Start workspace')}
                  <ArrowRight className="size-4" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={onClose}
                      aria-label={t('taskProviders.qunli.closeDetail', 'Close')}
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {t('taskProviders.qunli.closeDetail', 'Close')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
              <QunliTaskStatusControl
                task={displayed}
                metadata={metadata}
                pending={savingStatus}
                onChange={(statusId) => void changeStatus(statusId)}
              />
              <span className="flex items-center gap-1">
                <QunliIcon className="size-3" />
                {displayed.type?.name ?? '–'}
              </span>
              <span className={cn(getQunliPriorityTone(displayed.priority?.name))}>
                {displayed.priority?.name ?? t('taskProviders.qunli.noPriority', 'No priority')}
              </span>
              <span>
                {displayed.assignee?.name ?? t('taskProviders.qunli.unassigned', 'Unassigned')}
              </span>
              {displayed.dueDate ? (
                <span>
                  {t('taskProviders.qunli.dueDate', 'Due {{date}}', { date: displayed.dueDate })}
                </span>
              ) : null}
            </div>
            <QunliTaskSheetBody
              task={displayed}
              detail={detailState.detail}
              comments={detailState.comments}
              error={detailState.error}
              loading={detailState.loading}
              actions={actions}
              onStartWorkspace={onStartWorkspace}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
