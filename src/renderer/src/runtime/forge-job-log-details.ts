import type { GitLabProjectRef } from '../../../shared/gitlab-types'
import type { PRCheckDetail, PRCheckRunDetails } from '../../../shared/github/check-types'
import { loadGiteaJobLogDetails } from './gitea-job-log-client'
import { loadGitLabJobLogDetails } from './gitlab-job-trace-client'

/** Gitea and GitLab jobs read logs from their own forge; null leaves GitHub check-runs to the caller. */
export async function loadForgeJobLogDetails(args: {
  repoPath: string
  repoId?: string
  repoOwnerExecutionHostId?: string
  check: PRCheckDetail
  gitlabProjectRef?: GitLabProjectRef | null
}): Promise<PRCheckRunDetails | null> {
  if (args.check.giteaJobId) {
    return loadGiteaJobLogDetails({
      repoPath: args.repoPath,
      repoId: args.repoId,
      repoOwnerExecutionHostId: args.repoOwnerExecutionHostId,
      check: args.check
    })
  }
  if (args.check.gitlabJobId) {
    return loadGitLabJobLogDetails({
      repoPath: args.repoPath,
      repoId: args.repoId,
      repoOwnerExecutionHostId: args.repoOwnerExecutionHostId,
      check: args.check,
      // Why: a fork MR's job lives in the source project, not the repo's own.
      projectRef: args.gitlabProjectRef ?? null
    })
  }
  return null
}
