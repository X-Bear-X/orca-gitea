import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { giteaCliExecFileAsyncMock } = vi.hoisted(() => ({
  giteaCliExecFileAsyncMock: vi.fn()
}))

vi.mock('../git/command-runner/gitea-cli-exec-file', () => ({
  giteaCliExecFileAsync: giteaCliExecFileAsyncMock
}))

import { _resetGiteaCliStateCache } from './cli-logins'
import {
  giteaCliApiArgs,
  giteaRequest,
  GiteaTransportError,
  parseGiteaCliApiStatus
} from './transport'

const OLD_ENV = process.env
const missing = (command: string) =>
  Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' })

type CliCall = [command: 'gt' | 'tea', args: string[]]

/** Answers probes like a machine with the given CLIs, then `api` calls with `apiReply`. */
function primeCli(
  options: {
    gt?: unknown[] | null
    tea?: unknown[] | null
    apiReply?: (call: CliCall) => Promise<{ stdout: string; stderr: string }>
  } = {}
): void {
  giteaCliExecFileAsyncMock.mockImplementation(async (command: 'gt' | 'tea', args: string[]) => {
    const accounts = command === 'gt' ? options.gt : options.tea
    if (accounts === null || accounts === undefined) {
      throw missing(command)
    }
    if (args[0] === '--version') {
      return {
        stdout: 'gt version 1.1.0\nhttps://gitea.com/gitea/cli/releases/tag/v1.1.0',
        stderr: ''
      }
    }
    if (args[0] === 'auth' || args[0] === 'login') {
      return { stdout: JSON.stringify(accounts), stderr: '' }
    }
    return (
      options.apiReply?.([command, args]) ??
      Promise.resolve({
        stdout: '{"number":7}',
        stderr: 'HTTP/2.0 200 OK\nContent-Type: application/json\n'
      })
    )
  })
}

const gtAccount = {
  host: 'https://git.example.com',
  user: 'ana',
  credential_available: true,
  credential_store: 'keyring',
  error: ''
}

describe('Gitea transport', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    delete process.env.ORCA_GITEA_TOKEN
    _resetGiteaCliStateCache()
    giteaCliExecFileAsyncMock.mockReset()
    vi.unstubAllGlobals()
  })

  afterAll(() => {
    process.env = OLD_ENV
    vi.unstubAllGlobals()
  })

  it('reads the HTTP status both CLIs print with -i', () => {
    expect(parseGiteaCliApiStatus('HTTP/2.0 404 Not Found\nDate: x\n')).toBe(404)
    expect(parseGiteaCliApiStatus('Error: login name does not exist')).toBeNull()
  })

  it('builds gt api arguments with the instance host and body fields', () => {
    const login = {
      cli: 'gt' as const,
      name: 'https://git.example.com',
      url: 'https://git.example.com',
      user: 'ana'
    }

    expect(
      giteaCliApiArgs(login, '/repos/team/repo/pulls', {
        method: 'POST',
        accept: 'application/json',
        body: { title: 'Add Gitea', draft: true }
      })
    ).toEqual([
      'api',
      '--host',
      'https://git.example.com',
      '-i',
      '-X',
      'POST',
      '/repos/team/repo/pulls',
      '-H',
      'Accept: application/json',
      '-f',
      'title=Add Gitea',
      '-F',
      'draft=true'
    ])
  })

  it('prefers gt over tea for the same instance', async () => {
    primeCli({
      gt: [gtAccount],
      tea: [{ name: 'work', url: 'https://git.example.com', user: 'ana' }]
    })

    await expect(
      giteaRequest('https://git.example.com/api/v1', '/repos/team/repo/pulls', {
        searchParams: { state: 'all', page: 2 },
        timeoutMs: 15_000
      })
    ).resolves.toEqual({ status: 200, text: '{"number":7}' })

    expect(giteaCliExecFileAsyncMock).toHaveBeenLastCalledWith(
      'gt',
      [
        'api',
        '--host',
        'https://git.example.com',
        '-i',
        '-X',
        'GET',
        '/repos/team/repo/pulls?state=all&page=2'
      ],
      { timeout: 15_000, maxBuffer: 64 * 1024 * 1024, idempotent: true }
    )
  })

  it('falls back to tea when only tea has a login for the instance', async () => {
    primeCli({ gt: [], tea: [{ name: 'work', url: 'https://git.example.com', user: 'ana' }] })

    await giteaRequest('https://git.example.com/api/v1', '/user')

    expect(giteaCliExecFileAsyncMock).toHaveBeenLastCalledWith(
      'tea',
      ['api', '-l', 'work', '-i', '-X', 'GET', '/user'],
      expect.objectContaining({ idempotent: true })
    )
  })

  it('returns HTTP errors that gt reports with a failing exit code', async () => {
    primeCli({
      gt: [gtAccount],
      apiReply: () =>
        Promise.reject(
          Object.assign(new Error('Command failed: gt api'), {
            stdout: '{"message":"not found"}',
            stderr: 'HTTP/2.0 404 Not Found\nContent-Type: application/json\n'
          })
        )
    })

    await expect(
      giteaRequest('https://git.example.com/api/v1', '/repos/team/repo/pulls/9')
    ).resolves.toEqual({
      status: 404,
      text: '{"message":"not found"}'
    })
  })

  it('surfaces CLI failures that never reached the server', async () => {
    primeCli({
      gt: [gtAccount],
      apiReply: () =>
        Promise.reject(
          Object.assign(new Error('Command failed'), {
            stderr: 'Error: no account for https://git.example.com\n'
          })
        )
    })

    await expect(giteaRequest('https://git.example.com/api/v1', '/user')).rejects.toThrow(
      'no account for https://git.example.com'
    )
  })

  it('reports a killed CLI call as a timeout', async () => {
    primeCli({
      gt: [gtAccount],
      apiReply: () =>
        Promise.reject(Object.assign(new Error('Command failed'), { killed: true, stderr: '' }))
    })

    const error = await giteaRequest('https://git.example.com/api/v1', '/user').catch(
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(GiteaTransportError)
    expect((error as GiteaTransportError).timedOut).toBe(true)
  })

  it('falls back to ORCA_GITEA_TOKEN over HTTP when no CLI covers the host', async () => {
    primeCli({ gt: [], tea: null })
    process.env.ORCA_GITEA_TOKEN = 'legacy-token'
    const fetchMock = vi.fn(async () => Response.json({ login: 'ana' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(giteaRequest('https://git.example.com/api/v1', '/user')).resolves.toEqual({
      status: 200,
      text: '{"login":"ana"}'
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(url)).toBe('https://git.example.com/api/v1/user')
    expect((init.headers as Record<string, string>).Authorization).toBe('token legacy-token')
  })
})
