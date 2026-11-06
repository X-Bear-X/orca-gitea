import { stripAnsiEscapeSequences } from './ansi-escape-sequences'
import { sliceCheckLogTail } from './source-control/checks/logs/check-job-log-tail-slice'
import type { PRCheckDetail, PRCheckRunDetails } from './github/check-types'
import type { PRComment } from './github/comment-types'

export type GiteaActionStep = {
  name: string
  status: string | null
  conclusion: string | null
  startedAt: string | null
  completedAt: string | null
}

export type GiteaActionJob = {
  id: number
  runId: number
  workflow: string | null
  name: string
  status: string
  conclusion: string | null
  url: string | null
  startedAt: string | null
  completedAt: string | null
  steps: GiteaActionStep[]
}

export type GiteaPullRequestDetails = {
  jobs: GiteaActionJob[]
  comments: PRComment[]
}

export type GiteaJobLogResult = { ok: true; log: string } | { ok: false; error: string }

export function mapGiteaJobStatusToCheckStatus(status: string): PRCheckDetail['status'] {
  const s = status.toLowerCase()
  if (s === 'queued' || s === 'waiting' || s === 'blocked' || s === 'pending') {
    return 'queued'
  }
  if (s === 'in_progress' || s === 'running') {
    return 'in_progress'
  }
  return 'completed'
}

export function mapGiteaJobConclusion(
  status: string,
  conclusion: string | null
): PRCheckDetail['conclusion'] {
  const value = (conclusion || status).toLowerCase()
  if (value === 'success') {
    return 'success'
  }
  if (value === 'failure' || value === 'failed') {
    return 'failure'
  }
  if (value === 'cancelled' || value === 'canceled') {
    return 'cancelled'
  }
  if (value === 'skipped') {
    return 'skipped'
  }
  if (value === 'timed_out') {
    return 'timed_out'
  }
  if (mapGiteaJobStatusToCheckStatus(status) !== 'completed') {
    return 'pending'
  }
  return null
}

export function giteaJobsToPRChecks(jobs: GiteaActionJob[]): PRCheckDetail[] {
  return jobs.map((job) => ({
    name: job.workflow ? `${job.workflow}: ${job.name}` : job.name,
    status: mapGiteaJobStatusToCheckStatus(job.status),
    conclusion: mapGiteaJobConclusion(job.status, job.conclusion),
    url: job.url,
    ...(job.id ? { giteaJobId: job.id } : {})
  }))
}

/** New, edited, deleted or resolved comments count as a PR update for polling cadence. */
export function giteaCommentsSignature(comments: readonly PRComment[]): string {
  return comments
    .map((comment) => `${comment.id}:${textHash(comment.body)}:${comment.isResolved === true}`)
    .join(',')
}

function textHash(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

const LOG_TIMESTAMP_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z /gm
const MAX_RAW_LOG_CHARS = 512 * 1024

export function giteaJobLogToExcerpt(log: string): string {
  if (!log) {
    return ''
  }
  let tail = log
  if (tail.length > MAX_RAW_LOG_CHARS) {
    tail = tail.slice(tail.length - MAX_RAW_LOG_CHARS)
    const firstLineBreak = tail.indexOf('\n')
    tail = firstLineBreak === -1 ? tail : tail.slice(firstLineBreak + 1)
  }
  const readable = stripAnsiEscapeSequences(tail)
    .replace(/\r\n?/g, '\n')
    .replace(LOG_TIMESTAMP_PREFIX, '')
  return sliceCheckLogTail(readable).trim()
}

export function giteaJobCanHaveLog(check: PRCheckDetail): boolean {
  return check.status !== 'queued' && check.conclusion !== 'skipped'
}

export function giteaJobLogToCheckRunDetails(
  check: PRCheckDetail,
  log: string,
  strings: { emptyLog: string }
): PRCheckRunDetails {
  const logTail = giteaJobLogToExcerpt(log)
  return {
    name: check.name,
    status: check.status,
    conclusion: check.conclusion,
    url: check.url,
    detailsUrl: check.url,
    startedAt: null,
    completedAt: null,
    title: null,
    summary: logTail ? null : strings.emptyLog,
    text: null,
    annotations: [],
    jobs: logTail
      ? [
          {
            id: check.giteaJobId ?? null,
            name: check.name,
            status: check.status,
            conclusion: check.conclusion,
            startedAt: null,
            completedAt: null,
            url: check.url,
            logTail,
            steps: []
          }
        ]
      : []
  }
}
