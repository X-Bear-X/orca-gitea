import { taskProviderFailure } from '../../shared/work-items/task-provider-failure'
import type { QunliConnectionStatus, QunliViewer } from '../../shared/qunli/qunli-types'
import {
  clearQunliApiKey,
  getQunliApiKeyProtection,
  hasQunliApiKey,
  readQunliApiKey,
  saveQunliApiKey
} from './qunli-api-key-store'
import { asRecord, asRecords, asString } from './qunli-json'
import { isQunliAuthError, QunliApiError, qunliRequest } from './qunli-request'

type QunliConnectResult = { ok: true; viewer: QunliViewer } | { ok: false; error: string }

let cachedViewer: { apiKey: string; viewer: QunliViewer } | null = null
let lastCredentialError: string | undefined

/** An API key always belongs to an agent; "my tasks" are its manager's. */
export async function resolveQunliViewer(apiKey: string): Promise<QunliViewer> {
  const user = asRecord(await qunliRequest(apiKey, '/user'))
  const agentId = asString(user?.id)
  if (!user || !agentId) {
    throw new QunliApiError('Qunli did not return the API key owner.')
  }
  const account = asRecords(await qunliRequest(apiKey, '/accounts'))[0]
  const accountId = asString(account?.public_id) ?? asString(account?.id)
  if (!account || !accountId) {
    throw new QunliApiError('The API key has no Qunli team.')
  }
  const member = asRecord(
    await qunliRequest(
      apiKey,
      `/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(agentId)}`
    )
  )
  const manager = asRecord(member?.managed_by)
  const isAgent = asString(user.kind) === 'agent'
  return {
    agentId,
    agentName: asString(user.name) ?? agentId,
    accountId,
    accountName: asString(account.name) ?? accountId,
    // A human key would see its own tasks; agents act for their manager.
    managerId: isAgent ? asString(manager?.id) : agentId,
    managerName: isAgent ? asString(manager?.name) : asString(user.name)
  }
}

export function getQunliApiKey(): string | null {
  return readQunliApiKey()
}

export async function getQunliViewer(): Promise<QunliViewer | null> {
  const apiKey = readQunliApiKey()
  if (!apiKey) {
    cachedViewer = null
    return null
  }
  if (cachedViewer?.apiKey === apiKey) {
    return cachedViewer.viewer
  }
  const viewer = await resolveQunliViewer(apiKey)
  cachedViewer = { apiKey, viewer }
  lastCredentialError = undefined
  return viewer
}

export async function getStatus(): Promise<QunliConnectionStatus> {
  let connected: boolean
  try {
    connected = hasQunliApiKey()
  } catch (error) {
    return {
      connected: false,
      viewer: null,
      credentialError: error instanceof Error ? error.message : String(error)
    }
  }
  if (!connected) {
    return { connected: false, viewer: null, credentialProtection: null }
  }
  let viewer: QunliViewer | null = null
  try {
    viewer = await getQunliViewer()
  } catch (error) {
    if (isQunliAuthError(error)) {
      lastCredentialError = error instanceof Error ? error.message : String(error)
    }
  }
  return {
    connected: true,
    viewer,
    ...(lastCredentialError ? { credentialError: lastCredentialError } : {}),
    credentialProtection: getQunliApiKeyProtection()
  }
}

export async function connect(apiKey: string): Promise<QunliConnectResult> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return taskProviderFailure('qunli.apiKeyRequired', 'Paste the API key of a Qunli agent.')
  }
  try {
    const viewer = await resolveQunliViewer(trimmed)
    saveQunliApiKey(trimmed)
    cachedViewer = { apiKey: trimmed, viewer }
    lastCredentialError = undefined
    return { ok: true, viewer }
  } catch (error) {
    return error instanceof Error
      ? { ok: false, error: error.message }
      : taskProviderFailure('qunli.connectionFailed', 'Could not connect to Qunli.')
  }
}

export function disconnect(): void {
  clearQunliApiKey()
  cachedViewer = null
  lastCredentialError = undefined
}

export async function testConnection(): Promise<QunliConnectResult> {
  const apiKey = readQunliApiKey()
  if (!apiKey) {
    return taskProviderFailure('qunli.notConnected', 'Not connected to Qunli.')
  }
  try {
    const viewer = await resolveQunliViewer(apiKey)
    cachedViewer = { apiKey, viewer }
    lastCredentialError = undefined
    return { ok: true, viewer }
  } catch (error) {
    if (isQunliAuthError(error) && error instanceof Error) {
      lastCredentialError = error.message
    }
    return error instanceof Error
      ? { ok: false, error: error.message }
      : taskProviderFailure('qunli.connectionFailed', 'Could not connect to Qunli.')
  }
}

export function _resetQunliClientCache(): void {
  cachedViewer = null
  lastCredentialError = undefined
}
