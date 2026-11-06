import { describe, expect, it } from 'vitest'
import type { HostedReviewInfo } from '../../../../shared/source-control/hosted-review/hosted-review-contracts'
import {
  nextHostedReviewUnchangedReads,
  type HostedReviewCacheEntry
} from './hosted-review-cache-state'

function giteaReview(overrides: Partial<HostedReviewInfo> = {}): HostedReviewInfo {
  return {
    provider: 'gitea',
    number: 172,
    title: 'Upgrade formulas',
    state: 'open',
    url: 'https://git.example.com/team/repo/pulls/172',
    status: 'failure',
    updatedAt: '2026-11-03T08:00:00Z',
    mergeable: 'UNKNOWN',
    headSha: 'abc123',
    ...overrides
  }
}

function entry(
  data: HostedReviewInfo | null,
  unchangedReads?: number
): HostedReviewCacheEntry<HostedReviewInfo> {
  return { data, fetchedAt: 1, ...(unchangedReads === undefined ? {} : { unchangedReads }) }
}

describe('nextHostedReviewUnchangedReads', () => {
  it('counts consecutive provider reads that return the same review', () => {
    expect(nextHostedReviewUnchangedReads(undefined, giteaReview(), true)).toBe(0)
    expect(nextHostedReviewUnchangedReads(entry(giteaReview()), giteaReview(), true)).toBe(1)
    expect(nextHostedReviewUnchangedReads(entry(giteaReview(), 4), giteaReview(), true)).toBe(5)
  })

  it('does not advance on cache hits or fallbacks', () => {
    expect(nextHostedReviewUnchangedReads(entry(giteaReview(), 4), giteaReview(), false)).toBe(4)
  })

  it.each([
    ['CI status', { status: 'success' as const }],
    ['a new comment or push bumping updatedAt', { updatedAt: '2026-11-03T08:05:00Z' }],
    ['a new head commit', { headSha: 'def456' }],
    ['the review state', { state: 'merged' as const }],
    ['the title', { title: 'Upgrade formulas v2' }]
  ])('restarts at 0 when %s changes', (_label, change) => {
    expect(nextHostedReviewUnchangedReads(entry(giteaReview(), 6), giteaReview(change), true)).toBe(
      0
    )
  })
})
