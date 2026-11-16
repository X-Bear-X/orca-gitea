import { useCallback } from 'react'
import { toast } from 'sonner'
import { taskProviderErrorMessage } from '@/lib/work-items/task-provider-error-copy'
import { qunliUpdateTaskStatus } from '@/runtime/qunli/runtime-qunli-client'
import { defaultScopeSource } from '@/runtime/hosts/selection/default-creation-host'
import { useAppStore } from '@/store'
import type { QunliTask } from '../../../../../shared/qunli/qunli-types'
import type { TaskPageQunliList } from './use-task-page-qunli-list'

/** Moves the card at once and puts it back when Qunli refuses the status. */
export function useQunliTaskMove(list: TaskPageQunliList) {
  const settings = useAppStore((s) => s.settings)
  const { metadata, replaceTask } = list
  return useCallback(
    async (task: QunliTask, statusId: string): Promise<void> => {
      const status = metadata.statuses.find((entry) => entry.id === statusId)
      if (!status) {
        return
      }
      replaceTask({ ...task, status })
      try {
        const result = await qunliUpdateTaskStatus(defaultScopeSource(settings), task.ref, statusId)
        if (result.ok) {
          replaceTask(result.value)
          return
        }
        replaceTask(task)
        toast.error(taskProviderErrorMessage(result))
      } catch (caught) {
        replaceTask(task)
        toast.error(caught instanceof Error ? caught.message : String(caught))
      }
    },
    [metadata.statuses, replaceTask, settings]
  )
}
