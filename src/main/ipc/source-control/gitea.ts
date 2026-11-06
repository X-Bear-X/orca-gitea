import { ipcMain } from 'electron'
import type { Store } from '../../persistence/loading-store/store'
import { getGiteaJobLog, getGiteaPullRequestDetails } from '../../gitea/pull-request-details'
import type { GitLabRepoSelectorArgs } from './gitlab-repo-access'
import {
  assertRegisteredRepo,
  hostedReviewOptionArgs,
  repoConnectionId
} from './gitlab-repo-access'

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid Gitea ${label}`)
  }
  return value
}

export function registerGiteaHandlers(store: Store): void {
  ipcMain.handle(
    'gitea:prDetails',
    async (_event, args: GitLabRepoSelectorArgs & { prNumber: number }) => {
      const repo = assertRegisteredRepo(args, store)
      return getGiteaPullRequestDetails(
        repo.path,
        positiveInteger(args.prNumber, 'pull request number'),
        repoConnectionId(repo),
        ...hostedReviewOptionArgs(store, repo)
      )
    }
  )

  ipcMain.handle(
    'gitea:jobLog',
    async (_event, args: GitLabRepoSelectorArgs & { jobId: number }) => {
      const repo = assertRegisteredRepo(args, store)
      return getGiteaJobLog(
        repo.path,
        positiveInteger(args.jobId, 'job id'),
        repoConnectionId(repo),
        ...hostedReviewOptionArgs(store, repo)
      )
    }
  )
}
