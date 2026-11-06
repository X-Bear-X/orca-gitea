import type { GiteaJobLogResult, GiteaPullRequestDetails } from '../../shared/gitea-review-details'

export type GiteaRepoSelectorArgs = {
  repoPath: string
  repoId?: string | null
}

export type GiteaApi = {
  prDetails: (
    args: GiteaRepoSelectorArgs & { prNumber: number }
  ) => Promise<GiteaPullRequestDetails>
  jobLog: (args: GiteaRepoSelectorArgs & { jobId: number }) => Promise<GiteaJobLogResult>
}
