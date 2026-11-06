import { describe, expect, it } from 'vitest'
import type { HostedReviewInfo } from '../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import { isHostedDetailsRefreshContext, selectChecksPanelReview } from './checks-panel-review'

function giteaReview(): HostedReviewInfo {
  return {
    provider: 'gitea',
    number: 172,
    title: 'Upgrade formulas',
    state: 'open',
    url: 'https://git.example.com/team/repo/pulls/172',
    status: 'failure',
    updatedAt: '2026-11-06T00:00:00Z',
    mergeable: 'UNKNOWN'
  }
}

describe('Gitea reviews in the checks panel', () => {
  it('selects a Gitea hosted review so its jobs and comments can load', () => {
    const review = giteaReview()

    expect(
      selectChecksPanelReview({
        hostedReview: review,
        pr: null,
        linkedPR: null,
        suppressedGitHubPR: null,
        linkedGitLabMR: null,
        linkedBitbucketPR: null,
        linkedAzureDevOpsPR: null,
        linkedGiteaPR: 172
      })
    ).toBe(review)
  })

  // Gitea once fell through to the GitHub refresh path, which cleared its jobs and comments.
  it('refreshes Gitea reviews through the hosted-review details path', () => {
    expect(
      isHostedDetailsRefreshContext({
        activeReview: giteaReview(),
        linkedGitLabMR: null,
        linkedGiteaPR: null
      })
    ).toBe(true)
    expect(
      isHostedDetailsRefreshContext({
        activeReview: null,
        linkedGitLabMR: null,
        linkedGiteaPR: 172
      })
    ).toBe(true)
    expect(
      isHostedDetailsRefreshContext({
        activeReview: null,
        linkedGitLabMR: null,
        linkedGiteaPR: null
      })
    ).toBe(false)
  })
})
