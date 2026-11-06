import type { PRComment } from '../../shared/github/comment-types'
import {
  giteaJobLogToExcerpt,
  type GiteaActionJob,
  type GiteaJobLogResult,
  type GiteaPullRequestDetails
} from '../../shared/gitea-review-details'
import {
  getHostedReviewLocalGitOptions,
  type HostedReviewExecutionOptions
} from '../source-control/hosted-review-git-options'
import { configuredApiBaseUrl, encodedRepoPath, requestJson } from './client'
import { giteaRequest } from './transport'
import { getGiteaRepoRef, type GiteaRepoRef } from './repository-ref'

const DETAILS_TIMEOUT_MS = 15_000
const JOB_LOG_TIMEOUT_MS = 30_000
const RUN_PAGE_LIMIT = 50

type RawGiteaUser = {
  login?: string | null
  username?: string | null
  avatar_url?: string | null
  type?: string | null
} | null

type RawGiteaPullRequestHead = { head?: { sha?: string | null } | null }

type RawGiteaWorkflowRun = {
  id: number
  path?: string | null
  run_attempt?: number | null
  status?: string | null
}

type RawGiteaWorkflowJob = {
  id: number
  run_id: number
  name?: string | null
  status?: string | null
  conclusion?: string | null
  html_url?: string | null
  started_at?: string | null
  completed_at?: string | null
  steps?: {
    name?: string | null
    status?: string | null
    conclusion?: string | null
    started_at?: string | null
    completed_at?: string | null
  }[]
}

type RawGiteaCommitStatus = {
  statuses?: { context?: string | null; target_url?: string | null }[]
}

type RawGiteaIssueComment = {
  id: number
  body?: string | null
  user?: RawGiteaUser
  html_url?: string | null
  created_at?: string | null
}

type RawGiteaReview = {
  id: number
  body?: string | null
  user?: RawGiteaUser
  state?: string | null
  comments_count?: number | null
  submitted_at?: string | null
  html_url?: string | null
}

type RawGiteaReviewComment = {
  id: number
  body?: string | null
  user?: RawGiteaUser
  path?: string | null
  position?: number | null
  original_position?: number | null
  resolver?: RawGiteaUser
  html_url?: string | null
  created_at?: string | null
}

async function resolveRepo(
  repoPath: string,
  connectionId: string | null | undefined,
  options: HostedReviewExecutionOptions
): Promise<GiteaRepoRef> {
  const repo = await getGiteaRepoRef(
    repoPath,
    connectionId,
    getHostedReviewLocalGitOptions(options)
  )
  if (!repo) {
    throw new Error('This repository is not hosted on Gitea.')
  }
  return repo
}

function repoApiPath(repo: GiteaRepoRef, path: string): string {
  return `/repos/${encodedRepoPath(repo)}${path}`
}

function getJson<T>(
  repo: GiteaRepoRef,
  path: string,
  searchParams?: Record<string, string | number>
): Promise<T | null> {
  return requestJson<T>(
    repo,
    repoApiPath(repo, path),
    { searchParams, timeoutMs: DETAILS_TIMEOUT_MS },
    true
  )
}

function userLogin(user: RawGiteaUser | undefined): string {
  return user?.login || user?.username || 'unknown'
}

function workflowFileName(path: string | null | undefined): string | null {
  const file = path?.split('@')[0]?.split('/').pop()?.trim()
  return file ? file.replace(/\.ya?ml$/i, '') : null
}

function workflowNamesByRunId(status: RawGiteaCommitStatus | null): Map<number, string> {
  const names = new Map<number, string>()
  for (const item of status?.statuses ?? []) {
    const runId = Number(item.target_url?.match(/\/actions\/runs\/(\d+)/)?.[1])
    const workflow = item.context?.split(' / ')[0]?.trim()
    if (runId && workflow && !names.has(runId)) {
      names.set(runId, workflow)
    }
  }
  return names
}

function latestRunPerWorkflow(runs: RawGiteaWorkflowRun[]): RawGiteaWorkflowRun[] {
  const byWorkflow = new Map<string, RawGiteaWorkflowRun>()
  for (const run of runs) {
    const key = run.path?.split('@')[0] ?? String(run.id)
    const current = byWorkflow.get(key)
    if (!current || run.id > current.id) {
      byWorkflow.set(key, run)
    }
  }
  return [...byWorkflow.values()].sort((a, b) => a.id - b.id)
}

async function fetchJobs(repo: GiteaRepoRef, headSha: string): Promise<GiteaActionJob[]> {
  const [runsPage, status] = await Promise.all([
    getJson<{ workflow_runs?: RawGiteaWorkflowRun[] }>(repo, '/actions/runs', {
      head_sha: headSha,
      limit: RUN_PAGE_LIMIT
    }),
    getJson<RawGiteaCommitStatus>(repo, `/commits/${encodeURIComponent(headSha)}/status`)
  ])
  const workflowNames = workflowNamesByRunId(status)
  const runs = latestRunPerWorkflow(runsPage?.workflow_runs ?? [])
  const jobsByRun = await Promise.all(
    runs.map(async (run) => {
      const page = await getJson<{ jobs?: RawGiteaWorkflowJob[] }>(
        repo,
        `/actions/runs/${run.id}/jobs`
      )
      const workflow = workflowNames.get(run.id) ?? workflowFileName(run.path)
      return (page?.jobs ?? []).map((job): GiteaActionJob => ({
        id: job.id,
        runId: job.run_id ?? run.id,
        workflow,
        name: job.name?.trim() || `job ${job.id}`,
        status: job.status ?? 'unknown',
        conclusion: job.conclusion ?? null,
        url: job.html_url ?? null,
        startedAt: job.started_at ?? null,
        completedAt: job.completed_at ?? null,
        steps: (job.steps ?? []).map((step) => ({
          name: step.name ?? '',
          status: step.status ?? null,
          conclusion: step.conclusion ?? null,
          startedAt: step.started_at ?? null,
          completedAt: step.completed_at ?? null
        }))
      }))
    })
  )
  return jobsByRun.flat()
}

function isBot(user: RawGiteaUser | undefined): boolean {
  return user?.type?.toLowerCase() === 'bot'
}

async function fetchComments(repo: GiteaRepoRef, prNumber: number): Promise<PRComment[]> {
  const [issueComments, reviews] = await Promise.all([
    getJson<RawGiteaIssueComment[]>(repo, `/issues/${prNumber}/comments`, { limit: 100 }),
    getJson<RawGiteaReview[]>(repo, `/pulls/${prNumber}/reviews`, { limit: 100 })
  ])
  const conversation: PRComment[] = (issueComments ?? []).map((comment) => ({
    id: comment.id,
    author: userLogin(comment.user),
    authorAvatarUrl: comment.user?.avatar_url ?? '',
    body: comment.body ?? '',
    createdAt: comment.created_at ?? '',
    url: comment.html_url ?? '',
    isBot: isBot(comment.user)
  }))
  const reviewBodies: PRComment[] = (reviews ?? [])
    .filter((review) => review.body?.trim())
    .map((review) => ({
      id: review.id,
      author: userLogin(review.user),
      authorAvatarUrl: review.user?.avatar_url ?? '',
      body: review.body ?? '',
      createdAt: review.submitted_at ?? '',
      url: review.html_url ?? '',
      isBot: isBot(review.user)
    }))
  const inlineByReview = await Promise.all(
    (reviews ?? [])
      .filter((review) => (review.comments_count ?? 0) > 0)
      .map((review) =>
        getJson<RawGiteaReviewComment[]>(repo, `/pulls/${prNumber}/reviews/${review.id}/comments`)
      )
  )
  const inline: PRComment[] = inlineByReview.flat().flatMap((comment) => {
    if (!comment) {
      return []
    }
    const line = comment.position || comment.original_position || undefined
    return [
      {
        id: comment.id,
        author: userLogin(comment.user),
        authorAvatarUrl: comment.user?.avatar_url ?? '',
        body: comment.body ?? '',
        createdAt: comment.created_at ?? '',
        url: comment.html_url ?? '',
        isBot: isBot(comment.user),
        ...(comment.path ? { path: comment.path } : {}),
        ...(line ? { line } : {}),
        ...(comment.resolver ? { isResolved: true } : {})
      }
    ]
  })
  return [...conversation, ...reviewBodies, ...inline].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
}

export async function getGiteaPullRequestDetails(
  repoPath: string,
  prNumber: number,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<GiteaPullRequestDetails> {
  const repo = await resolveRepo(repoPath, connectionId, options)
  const pr = await getJson<RawGiteaPullRequestHead>(repo, `/pulls/${prNumber}`)
  const headSha = pr?.head?.sha?.trim()
  const [jobs, comments] = await Promise.all([
    headSha ? fetchJobs(repo, headSha) : Promise.resolve([]),
    fetchComments(repo, prNumber)
  ])
  return { jobs, comments }
}

export async function getGiteaJobLog(
  repoPath: string,
  jobId: number,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<GiteaJobLogResult> {
  try {
    const repo = await resolveRepo(repoPath, connectionId, options)
    const response = await giteaRequest(
      configuredApiBaseUrl(repo),
      repoApiPath(repo, `/actions/jobs/${jobId}/logs`),
      { accept: 'text/plain', timeoutMs: JOB_LOG_TIMEOUT_MS }
    )
    if (response.status === 404) {
      return { ok: true, log: '' }
    }
    if (response.status < 200 || response.status >= 300) {
      return { ok: false, error: `Gitea job log request failed: HTTP ${response.status}` }
    }
    return { ok: true, log: giteaJobLogToExcerpt(response.text) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
