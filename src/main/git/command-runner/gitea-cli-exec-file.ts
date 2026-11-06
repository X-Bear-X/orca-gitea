import { extractExecError, parseRetryAfterMs } from '../exec-error'
import { resolveCommand } from './wsl-command-resolution'
import { resolveDefaultWslCliFallback } from './default-wsl-cli-fallback'
import { isHostCommandMissing } from './github-cli-host-fallback'
import { execFileCaptureToTermination } from './exec-file-capture'
import { logHostedCliDeadlineKill } from './hosted-cli-deadline-log'
import type { GitExecOptions } from './git-exec-options'
import { argsLookIdempotent } from './gh-idempotency'
import {
  isTransientGhError,
  sleep,
  GH_RETRY_AFTER_MAX_MS,
  GH_RETRY_DELAYS_MS
} from './gh-retry-policy'

const DEFAULT_GITEA_CLI_EXEC_TIMEOUT_MS = 30_000

/** gt is the official Gitea CLI; tea is its archived predecessor kept for older servers. */
export type GiteaCliCommand = 'gt' | 'tea'

export type GiteaCliExecOptions = Omit<GitExecOptions, 'cwd'> & {
  cwd?: string
  wslDistro?: string
  idempotent?: boolean
  allowDefaultWslFallback?: boolean
}

export async function giteaCliExecFileAsync(
  command: GiteaCliCommand,
  args: string[],
  options: GiteaCliExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  let resolved = resolveCommand(command, args, options.cwd, options.wslDistro)
  const timeoutMs = options.timeout ?? DEFAULT_GITEA_CLI_EXEC_TIMEOUT_MS
  let lastError: unknown
  let attemptedDefaultWslFallback = false
  for (let attempt = 0; attempt <= GH_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { stdout, stderr } = await execFileCaptureToTermination(
        resolved.binary,
        resolved.args,
        {
          cwd: resolved.cwd,
          encoding: (options.encoding ?? 'utf-8') as BufferEncoding,
          maxBuffer: options.maxBuffer,
          timeout: timeoutMs,
          env: options.env,
          signal: options.signal,
          onDeadlineKill: () => logHostedCliDeadlineKill(command, resolved.binary, args, timeoutMs)
        },
        resolved.termination
      )
      return { stdout: stdout as string, stderr: stderr as string }
    } catch (err) {
      lastError = err
      const { stderr } = extractExecError(err)
      if (
        process.platform === 'win32' &&
        !attemptedDefaultWslFallback &&
        resolved.wsl === null &&
        !options.cwd &&
        !options.wslDistro &&
        options.allowDefaultWslFallback !== false &&
        isHostCommandMissing(err, command)
      ) {
        const wslResolved = await resolveDefaultWslCliFallback(command, args)
        if (wslResolved) {
          resolved = wslResolved
          attemptedDefaultWslFallback = true
          attempt = -1
          continue
        }
      }
      const isLastAttempt = attempt >= GH_RETRY_DELAYS_MS.length
      const idempotent = options.idempotent ?? argsLookIdempotent(args)
      if (idempotent && !isLastAttempt && isTransientGhError(stderr)) {
        const retryAfterMs = parseRetryAfterMs(stderr)
        const delayMs =
          retryAfterMs !== null
            ? Math.min(retryAfterMs, GH_RETRY_AFTER_MAX_MS)
            : GH_RETRY_DELAYS_MS[attempt]
        await sleep(delayMs, options.signal)
        continue
      }
      throw err
    }
  }
  throw lastError
}
