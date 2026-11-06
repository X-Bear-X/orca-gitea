import { giteaCliExecFileAsync } from '../git/command-runner/gitea-cli-exec-file'
import type { GiteaCliCommand } from '../git/command-runner/gitea-cli-exec-file'
import { extractExecError } from '../git/exec-error'
import { isHostCommandMissing } from '../git/command-runner/github-cli-host-fallback'

export type GiteaCliLogin = {
  cli: GiteaCliCommand
  /** tea selects a login by name; gt selects it by its instance URL. */
  name: string
  url: string
  user: string | null
}

export type GiteaCliState = {
  gtInstalled: boolean
  teaInstalled: boolean
  /** gt logins first: it is the official CLI, tea only covers older setups. */
  logins: GiteaCliLogin[]
}

type CachedGiteaCliState = GiteaCliState & { expiresAt: number }

const CLI_STATE_CACHE_TTL_MS = 30_000
const CLI_PROBE_TIMEOUT_MS = 10_000

let cliStateCache: CachedGiteaCliState | null = null
let cliStateProbe: Promise<CachedGiteaCliState> | null = null

/** @internal - exposed for tests only */
export function _resetGiteaCliStateCache(): void {
  cliStateCache = null
  cliStateProbe = null
}

function stringField(entry: Record<string, unknown>, key: string): string | null {
  const value = entry[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function objectEntries(stdout: string): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(stdout || '[]')
  return Array.isArray(parsed)
    ? parsed.filter(
        (entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object'
      )
    : []
}

/** Only accounts gt can actually use: a named instance with an available, error-free credential. */
export function parseGtAuthStatus(stdout: string): GiteaCliLogin[] {
  return objectEntries(stdout).flatMap((entry) => {
    const host = stringField(entry, 'host')
    if (!host || entry.credential_available !== true || stringField(entry, 'error')) {
      return []
    }
    return [{ cli: 'gt' as const, name: host, url: host, user: stringField(entry, 'user') }]
  })
}

export function parseTeaLoginList(stdout: string): GiteaCliLogin[] {
  return objectEntries(stdout).flatMap((entry) => {
    const name = stringField(entry, 'name')
    const url = stringField(entry, 'url')
    return name && url ? [{ cli: 'tea' as const, name, url, user: stringField(entry, 'user') }] : []
  })
}

// Graphite's stacked-PR CLI is also called gt; only the Gitea one names gitea.com/gitea/cli.
export function isGiteaGtVersionOutput(output: string): boolean {
  return /gitea/i.test(output)
}

async function runProbe(command: GiteaCliCommand, args: string[]): Promise<string> {
  try {
    const { stdout } = await giteaCliExecFileAsync(command, args, { timeout: CLI_PROBE_TIMEOUT_MS })
    return stdout
  } catch (error) {
    if (isHostCommandMissing(error, command)) {
      throw error
    }
    // A failed status probe still prints the accounts it could read.
    return extractExecError(error).stdout
  }
}

async function probeGt(): Promise<{ installed: boolean; logins: GiteaCliLogin[] }> {
  try {
    const version = await giteaCliExecFileAsync('gt', ['--version'], {
      timeout: CLI_PROBE_TIMEOUT_MS
    })
    if (!isGiteaGtVersionOutput(`${version.stdout}\n${version.stderr}`)) {
      return { installed: false, logins: [] }
    }
  } catch {
    return { installed: false, logins: [] }
  }
  try {
    return {
      installed: true,
      logins: parseGtAuthStatus(await runProbe('gt', ['auth', 'status', '--json']))
    }
  } catch {
    return { installed: true, logins: [] }
  }
}

async function probeTea(): Promise<{ installed: boolean; logins: GiteaCliLogin[] }> {
  try {
    return {
      installed: true,
      logins: parseTeaLoginList(await runProbe('tea', ['login', 'list', '-o', 'json']))
    }
  } catch (error) {
    return { installed: !isHostCommandMissing(error, 'tea'), logins: [] }
  }
}

async function probeGiteaCliState(): Promise<CachedGiteaCliState> {
  const [gt, tea] = await Promise.all([probeGt(), probeTea()])
  return {
    expiresAt: Date.now() + CLI_STATE_CACHE_TTL_MS,
    gtInstalled: gt.installed,
    teaInstalled: tea.installed,
    logins: [...gt.logins, ...tea.logins]
  }
}

export async function getGiteaCliState(options: { force?: boolean } = {}): Promise<GiteaCliState> {
  if (!options.force && cliStateCache && cliStateCache.expiresAt > Date.now()) {
    return cliStateCache
  }
  if (!cliStateProbe) {
    cliStateProbe = probeGiteaCliState().finally(() => {
      cliStateProbe = null
    })
  }
  cliStateCache = await cliStateProbe
  return cliStateCache
}

export type GiteaCliAuthFields = {
  cliInstalled: boolean
  cliAuthenticated: boolean
  /** The CLI Orca uses: the logged-in one, else the installed one (gt before the archived tea). */
  cli: GiteaCliCommand | null
}

export function giteaCliAuthFields(state: GiteaCliState): GiteaCliAuthFields {
  const login = state.logins[0]
  if (login) {
    return { cliInstalled: true, cliAuthenticated: true, cli: login.cli }
  }
  return {
    cliInstalled: state.gtInstalled || state.teaInstalled,
    cliAuthenticated: false,
    cli: state.gtInstalled ? 'gt' : state.teaInstalled ? 'tea' : null
  }
}

export function giteaCliAccountLabel(logins: GiteaCliLogin[]): string | null {
  const labels = logins.map((login) => {
    let host = login.url
    try {
      host = new URL(login.url).host
    } catch {
      // Keep the raw URL when the CLI stored something URL() cannot parse.
    }
    return login.user ? `${login.user}@${host}` : host
  })
  return labels.length > 0 ? [...new Set(labels)].join(', ') : null
}

function normalizedPath(pathname: string): string {
  return pathname.replace(/\/+$/, '').toLowerCase()
}

/** Pick the login whose instance owns this API base: deepest path wins, gt before tea on ties. */
export function findGiteaCliLoginForApiBase(
  logins: GiteaCliLogin[],
  apiBaseUrl: string
): GiteaCliLogin | null {
  let api: URL
  try {
    api = new URL(apiBaseUrl)
  } catch {
    return null
  }
  const apiPath = normalizedPath(api.pathname)
  let best: GiteaCliLogin | null = null
  let bestLength = -1
  for (const login of logins) {
    let server: URL
    try {
      server = new URL(login.url)
    } catch {
      continue
    }
    const serverPath = normalizedPath(server.pathname)
    if (server.host.toLowerCase() !== api.host.toLowerCase()) {
      continue
    }
    if (apiPath !== serverPath && !apiPath.startsWith(`${serverPath}/`)) {
      continue
    }
    if (serverPath.length > bestLength) {
      best = login
      bestLength = serverPath.length
    }
  }
  return best
}

export async function giteaCliLoginForApiBase(apiBaseUrl: string): Promise<GiteaCliLogin | null> {
  const { logins } = await getGiteaCliState()
  return findGiteaCliLoginForApiBase(logins, apiBaseUrl)
}
