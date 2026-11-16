import { QUNLI_ORIGIN } from '../../shared/qunli/qunli-task-ref'
import { asRecord } from './qunli-json'

const QUNLI_API_BASE = `${QUNLI_ORIGIN}/api/v1`
const REQUEST_TIMEOUT_MS = 20_000

export class QunliApiError extends Error {
  readonly status: number | null
  readonly code: string | null

  constructor(message: string, options: { status?: number | null; code?: string | null } = {}) {
    super(message)
    this.name = 'QunliApiError'
    this.status = options.status ?? null
    this.code = options.code ?? null
  }
}

export function isQunliAuthError(error: unknown): boolean {
  return error instanceof QunliApiError && (error.status === 401 || error.status === 403)
}

export type QunliPage = { data: unknown; meta: Record<string, unknown> | null }

type QunliRequestOptions = {
  method?: 'GET' | 'PATCH' | 'POST'
  searchParams?: Record<string, string | number | undefined | null>
  body?: unknown
}

function requestUrl(path: string, searchParams: QunliRequestOptions['searchParams']): URL {
  const url = new URL(`${QUNLI_API_BASE}${path}`)
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

/** Qunli wraps payloads in `{ data, meta? }` and reports errors as RFC 9457 problem+json. */
async function problemMessage(
  response: Response
): Promise<{ message: string; code: string | null }> {
  try {
    const record = asRecord(await response.json())
    if (record) {
      const detail = [record.detail, record.title, record.error_description, record.error].find(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      )
      const code = typeof record.code === 'string' ? record.code : null
      return { message: detail ?? `Qunli request failed: HTTP ${response.status}`, code }
    }
  } catch {
    // Non-JSON error bodies fall back to the status line.
  }
  return { message: `Qunli request failed: HTTP ${response.status}`, code: null }
}

export async function qunliRequestPage(
  apiKey: string,
  path: string,
  options: QunliRequestOptions = {}
): Promise<QunliPage> {
  let response: Response
  try {
    response = await fetch(requestUrl(path, options.searchParams), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new QunliApiError('Qunli did not answer in time.')
    }
    throw new QunliApiError(error instanceof Error ? error.message : String(error))
  }
  if (!response.ok) {
    const { message, code } = await problemMessage(response)
    throw new QunliApiError(message, { status: response.status, code })
  }
  const record = asRecord(await response.json())
  return { data: record?.data, meta: asRecord(record?.meta) }
}

export async function qunliRequest(
  apiKey: string,
  path: string,
  options: QunliRequestOptions = {}
): Promise<unknown> {
  return (await qunliRequestPage(apiKey, path, options)).data
}
