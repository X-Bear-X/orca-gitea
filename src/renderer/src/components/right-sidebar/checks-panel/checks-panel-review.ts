import type { PRInfo } from '../../../../../shared/github/pull-request-types'
import type { HostedReviewInfo } from '../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import { hostedReviewInfoFromGitHubPRInfo as gitHubPRToChecksPanelReview } from '../../../../../shared/source-control/hosted-review/hosted-review-github'
import { isGitHubPRSuppressed } from '../../../../../shared/worktree/github-pr-suppression'

export type ChecksPanelReview = HostedReviewInfo

export type ChecksPanelReviewSelectionInput = {
  hostedReview: HostedReviewInfo | null | undefined
  pr: PRInfo | null | undefined
  linkedPR: number | null
  suppressedGitHubPR: number | null
  linkedGitLabMR: number | null
  linkedBitbucketPR: number | null
  linkedAzureDevOpsPR: number | null
  linkedGiteaPR: number | null
}

export function selectChecksPanelReview({
  hostedReview,
  pr,
  linkedPR,
  suppressedGitHubPR,
  linkedGitLabMR,
  linkedBitbucketPR,
  linkedAzureDevOpsPR,
  linkedGiteaPR
}: ChecksPanelReviewSelectionInput): ChecksPanelReview | null {
  if (hostedReview?.provider === 'gitlab' || hostedReview?.provider === 'gitea') {
    return hostedReview
  }
  const hasNonGitHubLinkedReview =
    linkedGitLabMR !== null ||
    linkedBitbucketPR !== null ||
    linkedAzureDevOpsPR !== null ||
    linkedGiteaPR !== null
  if (hasNonGitHubLinkedReview) {
    return null
  }
  if (pr && linkedPR !== null && pr.number !== linkedPR) {
    return null
  }
  if (pr && isGitHubPRSuppressed({ linkedPR, suppressedGitHubPR }, pr.number)) {
    return null
  }
  return pr ? gitHubPRToChecksPanelReview(pr) : null
}

/** Refresh through the hosted-review card + details path for GitLab and Gitea, never the GitHub PR cache. */
export function isHostedDetailsRefreshContext({
  activeReview,
  linkedGitLabMR,
  linkedGiteaPR
}: {
  activeReview: ChecksPanelReview | null
  linkedGitLabMR: number | null
  linkedGiteaPR: number | null
}): boolean {
  return (
    activeReview?.provider === 'gitlab' ||
    activeReview?.provider === 'gitea' ||
    linkedGitLabMR !== null ||
    linkedGiteaPR !== null
  )
}
