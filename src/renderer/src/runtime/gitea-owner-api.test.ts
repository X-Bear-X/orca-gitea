import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { callRuntimeRpcMock, forgeCredentialTargetMock } = vi.hoisted(() => ({
  callRuntimeRpcMock: vi.fn(),
  forgeCredentialTargetMock: vi.fn()
}))

vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc: callRuntimeRpcMock }))
vi.mock('./forge-credential-target', () => ({ forgeCredentialTarget: forgeCredentialTargetMock }))

import { giteaApiFor } from './gitea-owner-api'

const localGitea = { prDetails: vi.fn(), jobLog: vi.fn() }

describe('giteaApiFor', () => {
  beforeEach(() => {
    callRuntimeRpcMock.mockReset()
    forgeCredentialTargetMock.mockReset()
    localGitea.prDetails.mockReset()
    localGitea.jobLog.mockReset()
    vi.stubGlobal('window', { api: { gitea: localGitea } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks the remote runtime that owns the repo instead of this machine', async () => {
    forgeCredentialTargetMock.mockReturnValue({ kind: 'environment', environmentId: 'env-1' })
    callRuntimeRpcMock.mockResolvedValue({ jobs: [], comments: [] })
    const selector = {
      repoPath: '/srv/goldendata',
      repoId: 'repo-1',
      repoOwnerExecutionHostId: 'environment:env-1'
    }

    await expect(giteaApiFor(selector).prDetails({ ...selector, prNumber: 172 })).resolves.toEqual({
      jobs: [],
      comments: []
    })
    await giteaApiFor(selector).jobLog({ ...selector, jobId: 5 })

    expect(callRuntimeRpcMock).toHaveBeenNthCalledWith(
      1,
      { kind: 'environment', environmentId: 'env-1' },
      'gitea.prDetails',
      expect.objectContaining({ repo: 'id:repo-1', prNumber: 172 }),
      { timeoutMs: 30_000 }
    )
    expect(callRuntimeRpcMock).toHaveBeenNthCalledWith(
      2,
      { kind: 'environment', environmentId: 'env-1' },
      'gitea.jobLog',
      expect.objectContaining({ repo: 'id:repo-1', jobId: 5 }),
      { timeoutMs: 65_000 }
    )
    expect(localGitea.prDetails).not.toHaveBeenCalled()
  })

  it('uses local IPC for repos on this machine', async () => {
    forgeCredentialTargetMock.mockReturnValue({ kind: 'local' })
    localGitea.prDetails.mockResolvedValue({ jobs: [], comments: [] })

    await giteaApiFor({ repoPath: '/repo' }).prDetails({ repoPath: '/repo', prNumber: 7 })

    expect(localGitea.prDetails).toHaveBeenCalledWith({ repoPath: '/repo', prNumber: 7 })
    expect(callRuntimeRpcMock).not.toHaveBeenCalled()
  })

  it('rejects instead of throwing when the owner host is unknown', async () => {
    forgeCredentialTargetMock.mockImplementation(() => {
      throw new Error('Unknown repository host')
    })

    await expect(
      giteaApiFor({ repoPath: '/repo', repoOwnerExecutionHostId: 'gone' }).prDetails({
        repoPath: '/repo',
        prNumber: 7
      })
    ).rejects.toThrow('Unknown repository host')
  })
})
