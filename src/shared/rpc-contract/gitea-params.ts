import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

const GiteaRepoSelector = z.object({
  repo: requiredString('Missing repo selector')
})

export const GiteaPullRequestDetailsParams = GiteaRepoSelector.extend({
  prNumber: z.number().int().positive()
})

export const GiteaJobLogParams = GiteaRepoSelector.extend({
  jobId: z.number().int().positive()
})
