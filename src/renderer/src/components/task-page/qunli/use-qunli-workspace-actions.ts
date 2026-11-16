import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import type { LinkedWorkItemSummary } from '@/lib/workspace/creation/new-workspace'
import { getRepoWorkspaceCreationTargetHint } from '@/lib/workspace/creation/project-host-workspace-target'
import {
  buildQunliTaskWorkspaceIndex,
  findQunliTaskWorkspaces
} from '@/lib/work-items/qunli/qunli-task-workspace-attachment'
import { qunliTaskWorkspaceName } from '@/lib/work-items/qunli/qunli-branch-name'
import { useAppStore } from '@/store'
import type { QunliTask } from '../../../../../shared/qunli/qunli-types'
import { normalizeTaskSourceContext } from '../../../../../shared/work-items/task-source-context'
import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
import type { QunliLinkedWorkspace } from './TaskList'

export function useQunliWorkspaceActions(model: TaskPageComposerActionsModel) {
  const {
    linearAttachmentWorkspaces,
    accountBackedTaskSourceHostId,
    fallbackTaskSourceProjectId,
    openModal,
    repos
  } = model
  const viewer = useAppStore((s) => s.qunliStatus.viewer)
  const accountId = viewer?.accountId ?? null

  const sourceContext = useMemo(
    () =>
      viewer
        ? normalizeTaskSourceContext({
            provider: 'qunli',
            projectId: fallbackTaskSourceProjectId,
            hostId: accountBackedTaskSourceHostId,
            providerIdentity: {
              provider: 'qunli',
              accountId: viewer.accountId,
              accountName: viewer.accountName
            },
            accountLabel: viewer.accountName
          })
        : null,
    [accountBackedTaskSourceHostId, fallbackTaskSourceProjectId, viewer]
  )

  const index = useMemo(
    () => buildQunliTaskWorkspaceIndex(linearAttachmentWorkspaces),
    [linearAttachmentWorkspaces]
  )

  const getLinkedWorkspace = useCallback(
    (task: QunliTask): QunliLinkedWorkspace | null => {
      const workspace = findQunliTaskWorkspaces(index, task.ref, accountId, sourceContext)[0]
      return workspace ? { id: workspace.id, name: workspace.displayName } : null
    },
    [accountId, index, sourceContext]
  )

  const openWorkspace = useCallback((workspace: QunliLinkedWorkspace): void => {
    if (activateAndRevealWorktree(workspace.id, { navigationIntent: 'user-open' }) === false) {
      toast.error(
        translate(
          'taskProviders.qunli.openWorkspaceFailed',
          'Unable to open the workspace linked to this card.'
        )
      )
    }
  }, [])

  const startWorkspace = useCallback(
    (task: QunliTask): void => {
      const linked = getLinkedWorkspace(task)
      if (linked) {
        openWorkspace(linked)
        return
      }
      if (!sourceContext) {
        toast.error(
          translate(
            'taskProviders.qunli.linkSourceUnavailable',
            'Couldn’t link this card. Reconnect Qunli, then try again.'
          )
        )
        return
      }
      const linkedWorkItem: LinkedWorkItemSummary = {
        type: 'issue',
        provider: 'qunli',
        number: 0,
        title: `${task.ref} ${task.title}`,
        url: task.url,
        qunliIdentifier: task.ref
      }
      const repo = repos.length === 1 ? repos[0] : undefined
      openModal('new-workspace-composer', {
        linkedWorkItem,
        taskSourceContext: sourceContext,
        initialRepoId: repo?.id,
        initialWorkspaceTarget: repo
          ? getRepoWorkspaceCreationTargetHint(repo, useAppStore.getState().projectHostSetups)
          : undefined,
        prefilledName: qunliTaskWorkspaceName(task),
        telemetrySource: 'sidebar'
      })
    },
    [getLinkedWorkspace, openModal, openWorkspace, repos, sourceContext]
  )

  return { startWorkspace, getLinkedWorkspace, openWorkspace }
}
