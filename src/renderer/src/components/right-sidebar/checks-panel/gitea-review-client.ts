import type { GiteaPullRequestDetails } from '../../../../../shared/gitea-review-details'
import type { ChecksPanelReview } from './checks-panel-review'
import { giteaApiFor } from '@/runtime/gitea-owner-api'

export function isGiteaChecksPanelReview(
  review: ChecksPanelReview | null
): review is ChecksPanelReview & { provider: 'gitea' } {
  return review?.provider === 'gitea'
}

export function isHostedDetailsChecksPanelReview(
  review: ChecksPanelReview | null | undefined
): review is ChecksPanelReview & { provider: 'gitlab' | 'gitea' } {
  return review?.provider === 'gitlab' || review?.provider === 'gitea'
}

export function hostedDetailsReviewOr<T extends ChecksPanelReview | null>(
  review: ChecksPanelReview | null | undefined,
  fallback: T
): (ChecksPanelReview & { provider: 'gitlab' | 'gitea' }) | T {
  return isHostedDetailsChecksPanelReview(review) ? review : fallback
}

export function fetchGiteaPRDetailsForChecks(args: {
  repoPath: string
  repoId?: string
  repoOwnerExecutionHostId?: string
  prNumber: number
}): Promise<GiteaPullRequestDetails> {
  return giteaApiFor(args).prDetails(args)
}
