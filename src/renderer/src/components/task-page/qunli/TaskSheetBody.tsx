import type { LucideIcon } from 'lucide-react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import CommentMarkdown from '@/components/comment-markdown/CommentMarkdown'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import type {
  QunliComment,
  QunliTask,
  QunliTaskDetail
} from '../../../../../shared/qunli/qunli-types'
import { formatRelativeTime } from '../task-page-source-context'

export type QunliSheetAction = { label: string; icon: LucideIcon; action: () => void }

export function QunliTaskSheetBody({
  task,
  detail,
  comments,
  error,
  loading,
  actions,
  onStartWorkspace
}: {
  task: QunliTask
  detail: QunliTaskDetail | null
  comments: readonly QunliComment[]
  error: string | null
  loading: boolean
  actions: readonly QunliSheetAction[]
  onStartWorkspace: (task: QunliTask) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_228px]">
      <div className="min-h-0 overflow-y-auto scrollbar-sleek">
        <section className="border-b border-border/40 px-4 py-4">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : loading && !detail ? (
            <div className="flex items-center justify-center py-8">
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : detail?.contentMarkdown.trim() ? (
            <CommentMarkdown
              variant="document"
              content={detail.contentMarkdown}
              className="text-[14px] leading-relaxed"
            />
          ) : (
            <p className="text-sm italic text-muted-foreground">
              {t('taskProviders.qunli.noContent', 'No description.')}
            </p>
          )}
        </section>
        <section className="px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground">
              {t('taskProviders.qunli.commentsTitle', 'Comments')}
            </span>
            {comments.length > 0 ? (
              <span className="text-[12px] text-muted-foreground">{comments.length}</span>
            ) : null}
          </div>
          {comments.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              {t('taskProviders.qunli.noComments', 'No comments yet.')}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-border/50 bg-muted/20">
                  <div className="flex min-w-0 items-center gap-2 border-b border-border/40 px-3 py-2">
                    {comment.author?.avatarUrl ? (
                      <img
                        src={comment.author.avatarUrl}
                        alt=""
                        className="size-5 shrink-0 rounded-full"
                      />
                    ) : null}
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {comment.author?.name ?? t('taskProviders.qunli.unknownAuthor', 'Unknown')}
                    </span>
                    {comment.createdAt ? (
                      <span className="shrink-0 text-[12px] text-muted-foreground">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-3 py-2">
                    <CommentMarkdown
                      variant="document"
                      content={comment.bodyMarkdown}
                      className="text-[13px] leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <aside className="border-t border-border/50 bg-muted/20 px-3 py-3 xl:border-l xl:border-t-0">
        <Button
          onClick={() => onStartWorkspace(task)}
          className="mb-3 w-full justify-center gap-2 sm:hidden"
        >
          {t('taskProviders.qunli.startWorkspace', 'Start workspace')}
          <ArrowRight className="size-4" />
        </Button>
        <div className="grid gap-1">
          {actions.map((item) => {
            const Icon = item.icon
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={item.action}
                    className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={6}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
