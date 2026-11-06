import type { PRCheckDetail, PRCheckRunDetails } from '../../../shared/github/check-types'
import {
  giteaJobCanHaveLog,
  giteaJobLogToCheckRunDetails
} from '../../../shared/gitea-review-details'
import { giteaApiFor } from './gitea-owner-api'

function emptyLogStrings(): { emptyLog: string } {
  return { emptyLog: 'No log is available for this Gitea job.' }
}

export async function loadGiteaJobLogDetails(args: {
  repoPath: string
  repoId?: string
  repoOwnerExecutionHostId?: string
  check: PRCheckDetail
}): Promise<PRCheckRunDetails | null> {
  const jobId = args.check.giteaJobId
  if (!jobId) {
    return null
  }
  if (!giteaJobCanHaveLog(args.check)) {
    return giteaJobLogToCheckRunDetails(args.check, '', emptyLogStrings())
  }
  const selector = {
    repoPath: args.repoPath,
    repoId: args.repoId,
    repoOwnerExecutionHostId: args.repoOwnerExecutionHostId
  }
  const result = await giteaApiFor(selector).jobLog({ ...selector, jobId })
  if (!result.ok) {
    throw new Error(result.error.trim() || 'Failed to load the Gitea job log.')
  }
  return giteaJobLogToCheckRunDetails(args.check, result.log, emptyLogStrings())
}
