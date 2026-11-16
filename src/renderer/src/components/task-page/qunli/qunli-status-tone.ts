import type { CSSProperties } from 'react'
import type { QunliStatusStage, QunliTaskStatus } from '../../../../../shared/qunli/qunli-types'
import { getJiraStatusTone } from '../jira/listing/task-page-jira-status-tone'
import { qunliTintStyle } from './qunli-colors'

/** Reuse the Jira pill colors: done is green, in progress is blue, the rest is muted. */
export function getQunliStatusTone(stage: QunliStatusStage | undefined): string {
  return getJiraStatusTone(
    stage === 'completed' ? 'done' : stage === 'in_progress' ? 'indeterminate' : 'new'
  )
}

/** The team's own status color when Qunli sends one, else the stage tone. */
export function qunliStatusPill(status: QunliTaskStatus): {
  className: string
  style: CSSProperties | undefined
} {
  const style = qunliTintStyle(status.color)
  return style
    ? { className: 'border-transparent text-foreground', style }
    : { className: getQunliStatusTone(status.stage), style: undefined }
}
