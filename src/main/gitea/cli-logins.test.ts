import { beforeEach, describe, expect, it, vi } from 'vitest'

const { giteaCliExecFileAsyncMock } = vi.hoisted(() => ({
  giteaCliExecFileAsyncMock: vi.fn()
}))

vi.mock('../git/command-runner/gitea-cli-exec-file', () => ({
  giteaCliExecFileAsync: giteaCliExecFileAsyncMock
}))

import {
  _resetGiteaCliStateCache,
  findGiteaCliLoginForApiBase,
  getGiteaCliState,
  isGiteaGtVersionOutput,
  parseGtAuthStatus,
  parseTeaLoginList,
  type GiteaCliLogin
} from './cli-logins'

const missing = (command: string) =>
  Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' })

describe('parseGtAuthStatus', () => {
  it('keeps only usable accounts of a named instance', () => {
    const stdout = JSON.stringify([
      // A GITEA_TOKEN in the environment without GITEA_CLI_HOST shows up as an unusable account.
      {
        host: '',
        user: '',
        credential_available: false,
        credential_store: 'environment',
        error: 'GITEA_TOKEN requires GITEA_CLI_HOST or GITEA_INSTANCE_URL naming its instance'
      },
      { host: 'https://git.example.com', user: 'ana', credential_available: true, error: '' },
      { host: 'https://old.example.com', user: 'bo', credential_available: false, error: '' }
    ])

    expect(parseGtAuthStatus(stdout)).toEqual([
      { cli: 'gt', name: 'https://git.example.com', url: 'https://git.example.com', user: 'ana' }
    ])
  })
})

describe('parseTeaLoginList', () => {
  it('reads tea snake_case logins', () => {
    expect(
      parseTeaLoginList(
        JSON.stringify([
          { name: 'work', url: 'https://git.example.com', ssh_host: 'git.example.com', user: 'ana' }
        ])
      )
    ).toEqual([{ cli: 'tea', name: 'work', url: 'https://git.example.com', user: 'ana' }])
  })
})

describe('isGiteaGtVersionOutput', () => {
  it('tells the Gitea gt from Graphite, which ships a CLI with the same name', () => {
    expect(
      isGiteaGtVersionOutput('gt version 1.1.0\nhttps://gitea.com/gitea/cli/releases/tag/v1.1.0')
    ).toBe(true)
    expect(isGiteaGtVersionOutput('1.4.3')).toBe(false)
  })
})

describe('findGiteaCliLoginForApiBase', () => {
  const logins: GiteaCliLogin[] = [
    { cli: 'gt', name: 'https://git.example.com', url: 'https://git.example.com', user: 'ana' },
    { cli: 'tea', name: 'work', url: 'https://git.example.com', user: 'ana' },
    { cli: 'tea', name: 'nested', url: 'https://git.example.com/code', user: 'bo' }
  ]

  it('prefers the deepest instance path, then gt over tea', () => {
    expect(findGiteaCliLoginForApiBase(logins, 'https://git.example.com/api/v1')?.cli).toBe('gt')
    expect(findGiteaCliLoginForApiBase(logins, 'https://git.example.com/code/api/v1')?.name).toBe(
      'nested'
    )
    expect(findGiteaCliLoginForApiBase(logins, 'https://git.example.com.evil/api/v1')).toBeNull()
  })
})

describe('getGiteaCliState', () => {
  beforeEach(() => {
    _resetGiteaCliStateCache()
    giteaCliExecFileAsyncMock.mockReset()
  })

  it('lists gt logins before tea logins and caches the probe', async () => {
    giteaCliExecFileAsyncMock.mockImplementation(async (command: string, args: string[]) => {
      if (args[0] === '--version') {
        return { stdout: 'gt version 1.1.0\nhttps://gitea.com/gitea/cli', stderr: '' }
      }
      return command === 'gt'
        ? {
            stdout: JSON.stringify([
              { host: 'https://git.example.com', user: 'ana', credential_available: true }
            ]),
            stderr: ''
          }
        : {
            stdout: JSON.stringify([{ name: 'work', url: 'https://old.example.com', user: 'bo' }]),
            stderr: ''
          }
    })

    const state = await getGiteaCliState()
    expect(state).toMatchObject({ gtInstalled: true, teaInstalled: true })
    expect(state.logins.map((login) => login.cli)).toEqual(['gt', 'tea'])

    await getGiteaCliState()
    expect(giteaCliExecFileAsyncMock).toHaveBeenCalledTimes(3)
    await getGiteaCliState({ force: true })
    expect(giteaCliExecFileAsyncMock).toHaveBeenCalledTimes(6)
  })

  it('ignores a Graphite gt and reports missing CLIs as not installed', async () => {
    giteaCliExecFileAsyncMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'tea') {
        throw missing('tea')
      }
      if (args[0] === '--version') {
        return { stdout: '1.4.3', stderr: '' }
      }
      throw new Error(`unexpected gt ${args.join(' ')}`)
    })

    await expect(getGiteaCliState()).resolves.toMatchObject({
      gtInstalled: false,
      teaInstalled: false,
      logins: []
    })
  })

  it('reads accounts from a gt status that exits non-zero', async () => {
    giteaCliExecFileAsyncMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'tea') {
        throw missing('tea')
      }
      if (args[0] === '--version') {
        return { stdout: 'gt version 1.1.0 gitea', stderr: '' }
      }
      throw Object.assign(new Error('exit 1'), {
        stdout: JSON.stringify([
          { host: 'https://git.example.com', user: 'ana', credential_available: true }
        ]),
        stderr: ''
      })
    })

    const state = await getGiteaCliState()
    expect(state.logins).toEqual([
      { cli: 'gt', name: 'https://git.example.com', url: 'https://git.example.com', user: 'ana' }
    ])
  })
})
