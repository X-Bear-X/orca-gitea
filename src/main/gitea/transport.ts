import { giteaCliExecFileAsync } from '../git/command-runner/gitea-cli-exec-file'
import { extractExecError } from '../git/exec-error'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import { giteaCliLoginForApiBase, type GiteaCliLogin } from './cli-logins'

export type GiteaRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  searchParams?: Record<string, string | number>
  body?: Record<string, unknown>
  accept?: string
  timeoutMs?: number
}

export type GiteaHttpResponse = {
  status: number
  text: string
}

export class GiteaTransportError extends Error {
  readonly timedOut: boolean

  constructor(message: string, options: { timedOut?: boolean } = {}) {
    super(message)
    this.name = 'GiteaTransportError'
    this.timedOut = options.timedOut ?? false
  }
}

const DEFAULT_TIMEOUT_MS = 5000
const MAX_CONCURRENT_CLI_CALLS = 4

let activeCliCalls = 0
const cliCallQueue: (() => void)[] = []

function envValue(name: string): string | null {
  const value = process.env[name]?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function giteaEnvToken(): string | null {
  return envValue('ORCA_GITEA_TOKEN')
}

async function acquireCliSlot(): Promise<void> {
  if (activeCliCalls < MAX_CONCURRENT_CLI_CALLS) {
    activeCliCalls++
    return
  }
  await new Promise<void>((resolve) => cliCallQueue.push(resolve))
}

function releaseCliSlot(): void {
  const next = cliCallQueue.shift()
  if (next) {
    next()
    return
  }
  activeCliCalls--
}

function pathWithQuery(path: string, searchParams?: GiteaRequestOptions['searchParams']): string {
  if (!searchParams) {
    return path
  }
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `${path}?${serialized}` : path
}

const HTTP_STATUS_LINE = /^HTTP\/[\d.]+\s+(\d{3})/m

/** Both CLIs print the response status with -i on stderr; tea even exits 0 for HTTP errors. */
export function parseGiteaCliApiStatus(stderr: string): number | null {
  const match = HTTP_STATUS_LINE.exec(stderr)
  return match ? Number(match[1]) : null
}

function cliErrorMessage(stderr: string, fallback: string): string {
  const line = stderr
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(
      (item) =>
        item.length > 0 && !HTTP_STATUS_LINE.test(item) && !/^(?!error:)[\w-]+:\s/i.test(item)
    )
  return line?.replace(/^Error:\s*/i, '') || fallback
}

/** gt sends -f strings and -F typed values as the JSON body of non-GET requests. */
function gtBodyArgs(body: Record<string, unknown>): string[] {
  return Object.entries(body).flatMap(([key, value]) =>
    typeof value === 'string'
      ? ['-f', `${key}=${value}`]
      : ['-F', `${key}=${JSON.stringify(value)}`]
  )
}

export function giteaCliApiArgs(
  login: GiteaCliLogin,
  path: string,
  options: GiteaRequestOptions
): string[] {
  const method = options.method ?? 'GET'
  const endpoint = pathWithQuery(path, options.searchParams)
  if (login.cli === 'gt') {
    return [
      'api',
      '--host',
      login.url,
      '-i',
      '-X',
      method,
      endpoint,
      ...(options.accept ? ['-H', `Accept: ${options.accept}`] : []),
      ...(options.body ? gtBodyArgs(options.body) : [])
    ]
  }
  return [
    'api',
    '-l',
    login.name,
    '-i',
    '-X',
    method,
    endpoint,
    ...(options.accept ? ['-H', `Accept:${options.accept}`] : []),
    ...(options.body ? ['-d', JSON.stringify(options.body)] : [])
  ]
}

async function requestViaCli(
  login: GiteaCliLogin,
  path: string,
  options: GiteaRequestOptions
): Promise<GiteaHttpResponse> {
  const method = options.method ?? 'GET'
  await acquireCliSlot()
  try {
    let stdout: string
    let stderr: string
    try {
      ;({ stdout, stderr } = await giteaCliExecFileAsync(
        login.cli,
        giteaCliApiArgs(login, path, options),
        {
          timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          maxBuffer: 64 * 1024 * 1024,
          idempotent: method === 'GET'
        }
      ))
    } catch (error) {
      const captured = extractExecError(error)
      // gt exits 1 for HTTP errors but still prints the body and status; only a missing status is fatal.
      if (parseGiteaCliApiStatus(captured.stderr) !== null) {
        ;({ stdout, stderr } = captured)
      } else if (
        (error as { killed?: unknown }).killed === true ||
        /timed out/i.test(captured.stderr)
      ) {
        throw new GiteaTransportError('Request timed out', { timedOut: true })
      } else {
        throw new GiteaTransportError(
          cliErrorMessage(captured.stderr, `Gitea CLI (${login.cli}) request failed`)
        )
      }
    }
    const status = parseGiteaCliApiStatus(stderr)
    if (status === null) {
      throw new GiteaTransportError(
        cliErrorMessage(stderr, `Gitea CLI (${login.cli}) request failed`)
      )
    }
    return { status, text: stdout }
  } finally {
    releaseCliSlot()
  }
}

async function requestViaFetch(
  apiBaseUrl: string,
  path: string,
  options: GiteaRequestOptions
): Promise<GiteaHttpResponse> {
  const url = new URL(
    `${apiBaseUrl.replace(/\/+$/, '')}${pathWithQuery(path, options.searchParams)}`
  )
  const token = giteaEnvToken()
  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: options.accept ?? 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `token ${token}` } : {})
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    })
    if (!response.ok && (options.method ?? 'GET') === 'GET') {
      await cancelUnreadResponseBody(response)
      return { status: response.status, text: '' }
    }
    return { status: response.status, text: await response.text() }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new GiteaTransportError('Request timed out', { timedOut: true })
    }
    throw error
  }
}

/** Route through the logged-in Gitea CLI (gt, else tea) like glab for GitLab; ORCA_GITEA_TOKEN stays a fallback. */
export async function giteaRequest(
  apiBaseUrl: string,
  path: string,
  options: GiteaRequestOptions = {}
): Promise<GiteaHttpResponse> {
  const login = await giteaCliLoginForApiBase(apiBaseUrl)
  return login ? requestViaCli(login, path, options) : requestViaFetch(apiBaseUrl, path, options)
}
