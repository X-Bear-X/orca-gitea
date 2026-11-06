import { describe, expect, it } from 'vitest'
import { ChecksDetailPollingPolicy } from './checks-detail-polling-policy'
import type { PRCheckDetail } from './check-types'

const passed: PRCheckDetail = {
  name: 'PR CI: lint',
  status: 'completed',
  conclusion: 'success',
  url: null
}

describe('ChecksDetailPollingPolicy.delayMs for Gitea', () => {
  it('lets the stepped Gitea backoff decide once it exceeds the 1 min floor', () => {
    const policy = new ChecksDetailPollingPolicy()
    policy.accept([passed])

    expect(policy.delayMs('open', 'success', 60_000, 'gitea')).toBe(60_000)
    expect(policy.delayMs('open', 'success', 420_000, 'gitea')).toBe(420_000)
    expect(policy.delayMs('open', 'success', 900_000, 'gitea')).toBe(900_000)
  })

  it('keeps closed Gitea reviews on the 15 min cadence', () => {
    const policy = new ChecksDetailPollingPolicy()
    policy.accept([passed])

    expect(policy.delayMs('closed', 'success', 60_000, 'gitea')).toBe(900_000)
  })
})
