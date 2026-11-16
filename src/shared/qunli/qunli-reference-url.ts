import type { WorkspaceAttachment } from '../worktree/types'
import { parseQunliTaskUrl, qunliTaskUrl } from './qunli-task-ref'

export function parseQunliReferenceUrl(href: string): WorkspaceAttachment | null {
  const task = parseQunliTaskUrl(href)
  return task
    ? {
        provider: 'qunli',
        type: 'issue',
        number: 0,
        identifier: task.ref,
        qunliIdentifier: task.ref,
        url: qunliTaskUrl(task.accountId, task.ref)
      }
    : null
}
