import { describe, expect, it } from 'vitest'
import {
  giteaUnchangedRefreshIntervalMs,
  nextGiteaRefreshIntervalMs,
  reviewRefreshIntervalMs
} from './review-refresh-policy'

describe('review refresh intervals', () => {
  it.each([
    [{ state: 'open', selected: true }, 60_000],
    [{ state: 'open', selected: false }, 120_000],
    [{ state: 'draft', selected: true }, 60_000],
    [{ state: 'draft' }, 120_000],
    [{ state: 'merged', checksStatus: 'pending' }, 60_000],
    [{ state: 'merged', checksStatus: null }, 60_000],
    [{ state: 'merged' }, 60_000],
    [{ state: 'merged', checksStatus: 'success' }, null],
    [{ state: 'merged', checksStatus: 'failure' }, null],
    [{ state: 'merged', checksStatus: 'neutral' }, null],
    [{ state: 'closed', selected: true }, 900_000],
    [{ state: 'closed' }, 900_000],
    [{ hasReview: false, selected: true }, 60_000],
    [{ hasReview: false }, 900_000],
    [{ state: 'open', checksStatus: 'success' }, 120_000],
    [{ state: 'open', checksStatus: 'failure', selected: true }, 60_000]
  ] as const)('uses %j → %s', (input, expected) => {
    expect(reviewRefreshIntervalMs(input)).toBe(expected)
  })

  it.each([
    [{ state: 'open', selected: true, provider: 'gitea' }, 60_000],
    [{ state: 'open', selected: false, provider: 'gitea', unchangedReads: 1 }, 180_000],
    [{ state: 'open', selected: true, provider: 'gitea', unchangedReads: 3 }, 420_000],
    [{ state: 'open', selected: true, provider: 'gitea', unchangedReads: 20 }, 900_000],
    [{ state: 'merged', checksStatus: 'pending', provider: 'gitea', unchangedReads: 2 }, 300_000],
    [{ state: 'merged', checksStatus: 'success', provider: 'gitea' }, null],
    [{ state: 'closed', provider: 'gitea', unchangedReads: 1 }, 900_000],
    [{ state: 'open', selected: true, provider: 'gitlab', unchangedReads: 5 }, 60_000]
  ] as const)(
    'steps self-hosted Gitea up while the review is unchanged: %j → %s',
    (input, expected) => {
      expect(reviewRefreshIntervalMs(input)).toBe(expected)
    }
  )

  it('walks 1, 3, 5 … 15 min while unchanged and restarts at 1 min on a change', () => {
    const intervals: number[] = []
    let interval = 60_000
    for (let read = 0; read < 9; read++) {
      intervals.push(interval)
      interval = nextGiteaRefreshIntervalMs(interval, false)
    }
    expect(intervals.map((ms) => ms / 60_000)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 15])
    expect(nextGiteaRefreshIntervalMs(900_000, true)).toBe(60_000)
    expect(nextGiteaRefreshIntervalMs(30_000, false)).toBe(180_000)
    expect(giteaUnchangedRefreshIntervalMs(2)).toBe(300_000)
  })
})
