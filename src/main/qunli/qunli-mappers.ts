import type {
  QunliAccountMetadata,
  QunliComment,
  QunliMember,
  QunliPriority,
  QunliProject,
  QunliTask,
  QunliTaskDetail,
  QunliTaskStatus,
  QunliTaskType
} from '../../shared/qunli/qunli-types'
import { asRecord, asRecords, asString, type JsonRecord } from './qunli-json'
import { QUNLI_ORIGIN, qunliTaskUrl } from '../../shared/qunli/qunli-task-ref'

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Links and avatars come as app-relative paths such as /2025/T18430. */
function absoluteQunliUrl(value: string | null): string | null {
  return value?.startsWith('/') ? `${QUNLI_ORIGIN}${value}` : value
}

export function mapMember(raw: unknown): QunliMember | null {
  const record = asRecord(raw)
  const id = asString(record?.id)
  if (!record || !id) {
    return null
  }
  const kind = asString(record.kind)
  const membership = asString(record.membership_status)
  return {
    id,
    name: asString(record.name) ?? id,
    avatarUrl: absoluteQunliUrl(asString(record.avatar_url)),
    kind: kind === 'human' || kind === 'agent' ? kind : null,
    active: membership === null || membership === 'active'
  }
}

function mapStatus(raw: JsonRecord): QunliTaskStatus | null {
  const id = asString(raw.id)
  return id
    ? {
        id,
        name: asString(raw.name) ?? id,
        color: asString(raw.color),
        stage: asString(raw.stage) ?? 'todo',
        position: asNumber(raw.position, 0)
      }
    : null
}

function mapType(raw: JsonRecord, typeStatuses: JsonRecord[]): QunliTaskType | null {
  const id = asString(raw.id)
  if (!id) {
    return null
  }
  const ownStatusIds = Array.isArray(raw.task_status_ids)
    ? raw.task_status_ids.flatMap((value) => asString(value) ?? [])
    : []
  const linkedStatusIds = typeStatuses
    .filter((link) => asString(link.task_type_id) === id)
    .flatMap((link) => asString(link.task_status_id) ?? [])
  return {
    id,
    name: asString(raw.name) ?? id,
    color: asString(raw.color),
    statusIds: ownStatusIds.length > 0 ? ownStatusIds : linkedStatusIds
  }
}

function mapPriority(raw: JsonRecord): QunliPriority | null {
  const id = asString(raw.id)
  return id
    ? {
        id,
        name: asString(raw.name) ?? id,
        color: asString(raw.color),
        position: asNumber(raw.position, 0)
      }
    : null
}

export function mapProject(raw: unknown): QunliProject | null {
  const record = asRecord(raw)
  const id = asString(record?.id)
  if (!record || !id) {
    return null
  }
  return { id, publicId: asString(record.public_id) ?? id, name: asString(record.name) ?? id }
}

/** Account payload carries statuses, types and priorities; projects and members come separately. */
export function mapAccountMetadata(
  account: unknown,
  projects: unknown,
  members: unknown
): QunliAccountMetadata {
  const record = asRecord(account) ?? {}
  const typeStatuses = asRecords(record.task_type_statuses)
  return {
    statuses: asRecords(record.task_statuses)
      .flatMap((status) => mapStatus(status) ?? [])
      .sort((a, b) => a.position - b.position),
    types: asRecords(record.task_types).flatMap((type) => mapType(type, typeStatuses) ?? []),
    priorities: asRecords(record.priorities)
      .flatMap((priority) => mapPriority(priority) ?? [])
      .sort((a, b) => a.position - b.position),
    projects: asRecords(projects).flatMap((project) => mapProject(project) ?? []),
    members: asRecords(members).flatMap((member) => mapMember(member) ?? [])
  }
}

function byId<T extends { id: string }>(items: readonly T[], id: string | null): T | null {
  return id ? (items.find((item) => item.id === id) ?? null) : null
}

export function mapTask(
  raw: unknown,
  metadata: QunliAccountMetadata,
  accountPublicId: string
): QunliTask | null {
  const record = asRecord(raw)
  const id = asString(record?.id)
  const ref = asString(record?.public_id)
  if (!record || !id || !ref) {
    return null
  }
  const embeddedProject = mapProject(record.project)
  return {
    id,
    ref,
    title: asString(record.title) ?? ref,
    url: absoluteQunliUrl(asString(record.app_url)) ?? qunliTaskUrl(accountPublicId, ref),
    status: byId(metadata.statuses, asString(record.task_status_id)),
    type: byId(metadata.types, asString(record.task_type_id)),
    priority: byId(metadata.priorities, asString(record.priority_id)),
    project: embeddedProject ?? byId(metadata.projects, asString(record.project_id)),
    assignee: byId(metadata.members, asString(record.assignee_id)),
    dueDate: asString(record.due_date),
    commentsCount: asNumber(record.comments_count, 0),
    createdAt: asString(record.created_at),
    updatedAt: asString(record.updated_at)
  }
}

export function mapTaskDetail(
  raw: unknown,
  metadata: QunliAccountMetadata,
  accountPublicId: string
): QunliTaskDetail | null {
  const task = mapTask(raw, metadata, accountPublicId)
  if (!task) {
    return null
  }
  const record = asRecord(raw) ?? {}
  return {
    ...task,
    contentMarkdown: asString(record.content_markdown) ?? asString(record.preview_text) ?? ''
  }
}

export function mapComment(raw: unknown, metadata: QunliAccountMetadata): QunliComment | null {
  const record = asRecord(raw)
  const id = asString(record?.id)
  if (!record || !id) {
    return null
  }
  return {
    id,
    author: byId(metadata.members, asString(record.creator_id)),
    bodyMarkdown: asString(record.content_markdown) ?? asString(record.preview_text) ?? '',
    createdAt: asString(record.created_at),
    url: absoluteQunliUrl(asString(record.app_url))
  }
}
