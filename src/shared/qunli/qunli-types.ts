import type { SecretAtRestProtection } from '../secure-storage/secret-at-rest-protection'

/** The Qunli agent the API key belongs to, its team and the human who manages it. */
export type QunliViewer = {
  agentId: string
  agentName: string
  /** Team ref used in paths and links, e.g. "2025" in https://qunli.co/2025/T17810. */
  accountId: string
  accountName: string
  /** Tasks shown as "mine" are this person's: Qunli only authorizes agents, never people. */
  managerId: string | null
  managerName: string | null
}

export type QunliConnectionStatus = {
  connected: boolean
  viewer: QunliViewer | null
  credentialError?: string
  credentialProtection?: SecretAtRestProtection | null
}

export type QunliStatusStage =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | (string & {})

export type QunliTaskStatus = {
  id: string
  name: string
  color: string | null
  stage: QunliStatusStage
  position: number
}

export type QunliTaskType = {
  id: string
  name: string
  color: string | null
  /** Statuses a task of this type may move to; empty means any. */
  statusIds: string[]
}

export type QunliPriority = {
  id: string
  name: string
  color: string | null
  position: number
}

export type QunliProject = {
  id: string
  publicId: string
  name: string
}

export type QunliMember = {
  id: string
  name: string
  avatarUrl: string | null
  kind: 'human' | 'agent' | null
  /** False once the member has left or is paused. */
  active: boolean
}

/** Statuses, types, priorities, projects and members of the connected team. */
export type QunliAccountMetadata = {
  statuses: QunliTaskStatus[]
  types: QunliTaskType[]
  priorities: QunliPriority[]
  projects: QunliProject[]
  members: QunliMember[]
}

export type QunliTask = {
  id: string
  /** Card ref such as "T17810". */
  ref: string
  title: string
  url: string
  status: QunliTaskStatus | null
  type: QunliTaskType | null
  priority: QunliPriority | null
  project: QunliProject | null
  assignee: QunliMember | null
  dueDate: string | null
  commentsCount: number
  createdAt: string | null
  updatedAt: string | null
}

export type QunliTaskDetail = QunliTask & {
  contentMarkdown: string
}

export type QunliTaskPage = {
  tasks: QunliTask[]
  total: number
  /** More tasks matched than one list loads; narrow by project or status. */
  truncated: boolean
}

export type QunliComment = {
  id: string
  author: QunliMember | null
  bodyMarkdown: string
  createdAt: string | null
  url: string | null
}

export type QunliFinishing = 'not_finished' | 'finished' | 'all'

export type QunliTaskListFilter = {
  /** Defaults to the agent's manager, i.e. "my tasks". */
  assigneeId?: string | null
  projectId?: string | null
  statusId?: string | null
  typeId?: string | null
  /** Defaults to open tasks only. */
  finishing?: QunliFinishing
}

export type QunliMutationResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string }
