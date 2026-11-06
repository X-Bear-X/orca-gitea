import { describe, expect, it } from 'vitest'
import {
  giteaCommentsSignature,
  giteaJobLogToCheckRunDetails,
  giteaJobLogToExcerpt,
  giteaJobsToPRChecks,
  mapGiteaJobConclusion,
  mapGiteaJobStatusToCheckStatus,
  type GiteaActionJob
} from './gitea-review-details'

function makeJob(overrides: Partial<GiteaActionJob> = {}): GiteaActionJob {
  return {
    id: 20123,
    runId: 8161,
    workflow: 'PR CI',
    name: 'lint-components',
    status: 'completed',
    conclusion: 'failure',
    url: 'https://git.example.com/acme/widgets/actions/runs/8161/jobs/20123',
    startedAt: null,
    completedAt: null,
    steps: [],
    ...overrides
  }
}

describe('giteaJobsToPRChecks', () => {
  it('maps Actions jobs to check rows that can load their logs', () => {
    expect(giteaJobsToPRChecks([makeJob()])).toEqual([
      {
        name: 'PR CI: lint-components',
        status: 'completed',
        conclusion: 'failure',
        url: 'https://git.example.com/acme/widgets/actions/runs/8161/jobs/20123',
        giteaJobId: 20123
      }
    ])
  })

  it('omits the workflow prefix when the workflow name is unknown', () => {
    expect(giteaJobsToPRChecks([makeJob({ workflow: null })])[0].name).toBe('lint-components')
  })
})

describe('Gitea job status mapping', () => {
  it.each([
    ['waiting', null, 'queued', 'pending'],
    ['running', null, 'in_progress', 'pending'],
    ['completed', 'success', 'completed', 'success'],
    ['completed', 'cancelled', 'completed', 'cancelled'],
    ['completed', 'skipped', 'completed', 'skipped'],
    ['failure', null, 'completed', 'failure']
  ] as const)('maps %s/%s', (status, conclusion, checkStatus, checkConclusion) => {
    expect(mapGiteaJobStatusToCheckStatus(status)).toBe(checkStatus)
    expect(mapGiteaJobConclusion(status, conclusion)).toBe(checkConclusion)
  })
})

describe('giteaJobLogToExcerpt', () => {
  it('drops runner timestamps and ANSI colors', () => {
    const log = [
      '2026-10-29T06:42:02.8490950Z \u001b[31m10133 files inspected, 2 offenses detected\u001b[0m',
      '2026-10-29T06:42:02.8809936Z ##[error]Process completed with exit code 1.'
    ].join('\r\n')

    expect(giteaJobLogToExcerpt(log)).toBe(
      '10133 files inspected, 2 offenses detected\n##[error]Process completed with exit code 1.'
    )
  })
})

describe('giteaJobLogToCheckRunDetails', () => {
  it('explains an empty log instead of showing an empty job', () => {
    const [check] = giteaJobsToPRChecks([makeJob()])
    const details = giteaJobLogToCheckRunDetails(check, '', { emptyLog: 'No log' })

    expect(details.summary).toBe('No log')
    expect(details.jobs).toEqual([])
  })

  it('keeps the job id on the log tail', () => {
    const [check] = giteaJobsToPRChecks([makeJob()])
    const details = giteaJobLogToCheckRunDetails(check, 'boom', { emptyLog: 'No log' })

    expect(details.jobs[0]).toMatchObject({ id: 20123, logTail: 'boom' })
  })
})

describe('giteaCommentsSignature', () => {
  const comment = {
    id: 1,
    author: 'ana',
    authorAvatarUrl: '',
    body: 'Please extract this query',
    createdAt: '2026-11-03T08:00:00Z',
    url: ''
  }

  it('changes when a comment is added, edited or resolved', () => {
    const base = giteaCommentsSignature([comment])

    expect(giteaCommentsSignature([comment])).toBe(base)
    expect(giteaCommentsSignature([comment, { ...comment, id: 2 }])).not.toBe(base)
    expect(giteaCommentsSignature([{ ...comment, body: 'Please extract this query!' }])).not.toBe(
      base
    )
    expect(giteaCommentsSignature([{ ...comment, body: 'Please inline this querys' }])).not.toBe(
      base
    )
    expect(giteaCommentsSignature([{ ...comment, isResolved: true }])).not.toBe(base)
  })
})
