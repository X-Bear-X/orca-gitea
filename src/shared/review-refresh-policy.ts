import type {
  HostedReviewProvider,
  HostedReviewState
} from './source-control/hosted-review/hosted-review-contracts'
import type { CheckStatus } from './github/pull-request-types'

export const REVIEW_REFRESH_COOLDOWN_MS = 10_000
export const CLOSED_REVIEW_REFRESH_INTERVAL_MS = 15 * 60_000

// Gitea is usually self-hosted: every unchanged read adds 2 min (1, 3, 5 … 15 min) and a change restarts at 1 min.
const GITEA_REFRESH_FIRST_MS = 60_000
const GITEA_REFRESH_STEP_MS = 2 * 60_000
const GITEA_REFRESH_MAX_MS = 15 * 60_000

export function giteaUnchangedRefreshIntervalMs(unchangedReads: number): number {
  return Math.min(
    GITEA_REFRESH_FIRST_MS + Math.max(0, unchangedReads) * GITEA_REFRESH_STEP_MS,
    GITEA_REFRESH_MAX_MS
  )
}

export function nextGiteaRefreshIntervalMs(previousMs: number, changed: boolean): number {
  if (changed) {
    return GITEA_REFRESH_FIRST_MS
  }
  return Math.min(
    Math.max(previousMs, GITEA_REFRESH_FIRST_MS) + GITEA_REFRESH_STEP_MS,
    GITEA_REFRESH_MAX_MS
  )
}

type ReviewRefreshIntervalInput = {
  state?: HostedReviewState | null
  checksStatus?: CheckStatus | null
  hasReview?: boolean | null
  selected?: boolean
  provider?: HostedReviewProvider | null
  /** Consecutive reads that returned the same review; only Gitea paces on it. */
  unchangedReads?: number
}

export function reviewRefreshIntervalMs(input: ReviewRefreshIntervalInput): number | null {
  const interval = baseReviewRefreshIntervalMs(input)
  if (interval === null || input.provider !== 'gitea' || input.state === 'closed') {
    return interval
  }
  return giteaUnchangedRefreshIntervalMs(input.unchangedReads ?? 0)
}

function baseReviewRefreshIntervalMs(input: ReviewRefreshIntervalInput): number | null {
  if (input.hasReview === false) {
    return input.selected ? 60_000 : 15 * 60_000
  }
  if (input.state === 'merged') {
    // Neutral means completed checks or no checks in the hosted-review contract.
    return input.checksStatus == null || input.checksStatus === 'pending' ? 60_000 : null
  }
  if (input.state === 'closed') {
    return CLOSED_REVIEW_REFRESH_INTERVAL_MS
  }
  return input.selected ? 60_000 : 120_000
}
