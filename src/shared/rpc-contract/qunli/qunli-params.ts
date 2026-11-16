import { z } from 'zod'
import { OptionalBoolean, requiredString } from '../rpc-param-primitives'

export const QunliConnect = z.object({
  apiKey: requiredString('API key is required')
})

export const QunliMetadata = z.object({ force: OptionalBoolean }).optional()

export const QunliListTasks = z.object({ filter: z.unknown().optional() }).optional()

export const QunliTaskRef = z.object({
  ref: requiredString('Task ref is required')
})

export const QunliUpdateTaskStatus = z.object({
  ref: requiredString('Task ref is required'),
  statusId: requiredString('Status is required')
})
