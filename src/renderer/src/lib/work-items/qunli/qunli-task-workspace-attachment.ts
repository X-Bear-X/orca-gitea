import { getWorkspaceAttachments } from '../../../../../shared/workspace-attachments/workspace-attachments'
import type { WorkspaceAttachment, Worktree } from '../../../../../shared/worktree/types'
import type { TaskSourceContext } from '../../../../../shared/work-items/task-source-context'
import {
  parseQunliTaskUrl,
  QUNLI_TASK_REF_PATTERN
} from '../../../../../shared/qunli/qunli-task-ref'

export type QunliTaskWorkspaceIndex = ReadonlyMap<string, readonly Worktree[]>

function qunliRef(item: WorkspaceAttachment): string | null {
  if (item.provider !== 'qunli') {
    return null
  }
  const value = (item.identifier ?? item.qunliIdentifier ?? '').trim()
  return QUNLI_TASK_REF_PATTERN.test(value)
    ? value.toUpperCase()
    : (parseQunliTaskUrl(item.url ?? '')?.ref ?? null)
}

function attachmentAccountId(item: WorkspaceAttachment): string | null {
  const identity = item.taskSourceContext?.providerIdentity
  if (identity?.provider === 'qunli' && identity.accountId) {
    return identity.accountId
  }
  return parseQunliTaskUrl(item.url ?? '')?.accountId ?? null
}

export function qunliAttachmentMatchesTask(
  item: WorkspaceAttachment,
  ref: string,
  accountId: string | null,
  source?: TaskSourceContext | null
): boolean {
  if (qunliRef(item) !== ref.toUpperCase()) {
    return false
  }
  if (source && (item.taskSourceContext?.hostId ?? 'local') !== source.hostId) {
    return false
  }
  const itemAccount = attachmentAccountId(item)
  return !accountId || !itemAccount || itemAccount === accountId
}

export function buildQunliTaskWorkspaceIndex(
  workspaces: readonly Worktree[]
): QunliTaskWorkspaceIndex {
  const index = new Map<string, Worktree[]>()
  for (const workspace of workspaces) {
    if (workspace.isArchived) {
      continue
    }
    const refs = new Set(getWorkspaceAttachments(workspace).map(qunliRef))
    for (const ref of refs) {
      if (ref) {
        index.set(ref, [...(index.get(ref) ?? []), workspace])
      }
    }
  }
  return index
}

export function findQunliTaskWorkspaces(
  index: QunliTaskWorkspaceIndex,
  ref: string,
  accountId: string | null,
  source?: TaskSourceContext | null
): readonly Worktree[] {
  return (index.get(ref.toUpperCase()) ?? [])
    .filter((workspace) =>
      getWorkspaceAttachments(workspace).some((item) =>
        qunliAttachmentMatchesTask(item, ref, accountId, source)
      )
    )
    .toSorted((a, b) => b.lastActivityAt - a.lastActivityAt)
}
