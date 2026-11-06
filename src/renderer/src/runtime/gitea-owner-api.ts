import type { GiteaApi } from '../../../preload/api/gitea-api'
import type {
  GiteaJobLogResult,
  GiteaPullRequestDetails
} from '../../../shared/gitea-review-details'
import { callRuntimeRpc } from './runtime-rpc-client'
import { forgeCredentialTarget, type ForgeRepoSelector } from './forge-credential-target'
import { mapRepoPathArg } from './runtime-repo-selector-params'

const GITEA_DETAILS_RPC_TIMEOUT_MS = 30_000
// Job logs can take the CLI's full 30 s deadline; leave room so its own error reaches the caller.
const GITEA_JOB_LOG_RPC_TIMEOUT_MS = 65_000

function runtimeGiteaApi(environmentId: string): GiteaApi {
  const target = { kind: 'environment', environmentId } as const
  return {
    prDetails: (args) =>
      callRuntimeRpc<GiteaPullRequestDetails>(target, 'gitea.prDetails', mapRepoPathArg(args), {
        timeoutMs: GITEA_DETAILS_RPC_TIMEOUT_MS
      }),
    jobLog: (args) =>
      callRuntimeRpc<GiteaJobLogResult>(target, 'gitea.jobLog', mapRepoPathArg(args), {
        timeoutMs: GITEA_JOB_LOG_RPC_TIMEOUT_MS
      })
  }
}

/** The Gitea API on the machine that owns the repo, like gitLabApiFor: remote runtimes answer over RPC. */
export function giteaApiFor(selector: ForgeRepoSelector): GiteaApi {
  let target: ReturnType<typeof forgeCredentialTarget>
  try {
    target = forgeCredentialTarget(selector)
  } catch (error) {
    // Why: callers await the result; an unknown owner must reject, not throw synchronously.
    return { prDetails: () => Promise.reject(error), jobLog: () => Promise.reject(error) }
  }
  return target.kind === 'environment' ? runtimeGiteaApi(target.environmentId) : window.api.gitea
}
