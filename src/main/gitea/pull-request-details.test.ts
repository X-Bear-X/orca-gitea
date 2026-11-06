import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { gitExecFileAsyncMock } = vi.hoisted(() => ({
  gitExecFileAsyncMock: vi.fn()
}))

vi.mock('../git/command-runner/git-exec-file', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  gitExecFileAsync: gitExecFileAsyncMock
}))
vi.mock('../git/command-runner/gitea-cli-exec-file', () => ({
  giteaCliExecFileAsync: vi.fn(async (command: string) => {
    throw Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' })
  })
}))

import { getGiteaJobLog, getGiteaPullRequestDetails } from './pull-request-details'
import { _resetGiteaRepoRefCache } from './repository-ref'

const OLD_ENV = process.env

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function stubGitea(routes: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: URL | string) => {
    const url = new URL(String(input))
    const key = `${url.pathname.replace('/api/v1/repos/team/repo', '')}${url.search}`
    const match = Object.keys(routes).find((route) => key === route || key.startsWith(`${route}?`))
    if (!match) {
      return jsonResponse({ message: 'not found' }, 404)
    }
    const body = routes[match]
    return typeof body === 'string' ? new Response(body) : jsonResponse(body)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Gitea pull request details', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV, ORCA_GITEA_TOKEN: 'gitea-token' }
    delete process.env.ORCA_GITEA_API_BASE_URL
    gitExecFileAsyncMock.mockReset()
    gitExecFileAsyncMock.mockResolvedValue({
      stdout: 'https://git.example.com/team/repo.git\n',
      stderr: ''
    })
    _resetGiteaRepoRefCache()
    vi.unstubAllGlobals()
  })

  afterAll(() => {
    process.env = OLD_ENV
    vi.unstubAllGlobals()
  })

  it('lists jobs from the latest run of each workflow and merges all comment kinds', async () => {
    const fetchMock = stubGitea({
      '/pulls/172': { head: { sha: 'abc123' } },
      '/actions/runs': {
        workflow_runs: [
          { id: 10, path: 'pr-ci.yml@refs/pull/172/head' },
          { id: 12, path: 'pr-ci.yml@refs/pull/172/head' },
          { id: 11, path: 'code-review.yml@refs/pull/172/head' }
        ]
      },
      '/commits/abc123/status': {
        statuses: [
          {
            context: 'PR CI / lint (pull_request)',
            target_url: '/team/repo/actions/runs/12/jobs/5'
          }
        ]
      },
      '/actions/runs/12/jobs': {
        jobs: [
          {
            id: 5,
            run_id: 12,
            name: 'lint',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://git.example.com/team/repo/actions/runs/12/jobs/5'
          }
        ]
      },
      '/actions/runs/11/jobs': {
        jobs: [{ id: 4, run_id: 11, name: 'review', status: 'running', conclusion: null }]
      },
      '/issues/172/comments': [
        { id: 1, body: 'conversation', user: { login: 'ana' }, created_at: '2026-10-01T00:00:00Z' }
      ],
      '/pulls/172/reviews': [
        {
          id: 2,
          body: 'review summary',
          user: { login: 'bot', type: 'Bot' },
          comments_count: 1,
          submitted_at: '2026-10-02T00:00:00Z'
        }
      ],
      '/pulls/172/reviews/2/comments': [
        {
          id: 3,
          body: 'inline',
          user: { login: 'bot', type: 'Bot' },
          path: 'app/models/form.rb',
          position: 12,
          resolver: { login: 'ana' },
          created_at: '2026-10-03T00:00:00Z'
        }
      ]
    })

    const details = await getGiteaPullRequestDetails('/repo', 172)

    expect(details.jobs.map((job) => [job.runId, job.workflow, job.name])).toEqual([
      [11, 'code-review', 'review'],
      [12, 'PR CI', 'lint']
    ])
    expect(details.comments).toEqual([
      expect.objectContaining({ id: 1, author: 'ana', body: 'conversation', isBot: false }),
      expect.objectContaining({ id: 2, body: 'review summary', isBot: true }),
      expect.objectContaining({
        id: 3,
        path: 'app/models/form.rb',
        line: 12,
        isResolved: true
      })
    ])
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringContaining('/runs/10/')
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('token gitea-token')
  })

  it('surfaces request failures instead of showing an empty panel', async () => {
    stubGitea({})

    await expect(getGiteaPullRequestDetails('/repo', 172)).rejects.toThrow('HTTP 404')
  })

  it('returns a readable job log excerpt', async () => {
    stubGitea({ '/actions/jobs/5/logs': '2026-10-29T06:42:02.8809936Z job failed\n' })

    await expect(getGiteaJobLog('/repo', 5)).resolves.toEqual({ ok: true, log: 'job failed' })
  })

  it('treats a missing job log as empty', async () => {
    stubGitea({})

    await expect(getGiteaJobLog('/repo', 5)).resolves.toEqual({ ok: true, log: '' })
  })
})
