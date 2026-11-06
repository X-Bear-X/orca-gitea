import { defineMethod } from '../core'
import {
  GiteaJobLogParams,
  GiteaPullRequestDetailsParams
} from '../../../../shared/rpc-contract/gitea-params'

export const GITEA_METHODS = [
  defineMethod({
    name: 'gitea.prDetails',
    permission: 'workspace',
    params: GiteaPullRequestDetailsParams,
    handler: async (params, { runtime }) =>
      runtime.getGiteaPullRequestDetails(params.repo, params.prNumber)
  }),
  defineMethod({
    name: 'gitea.jobLog',
    permission: 'workspace',
    params: GiteaJobLogParams,
    handler: async (params, { runtime }) => runtime.getGiteaJobLog(params.repo, params.jobId)
  })
]
