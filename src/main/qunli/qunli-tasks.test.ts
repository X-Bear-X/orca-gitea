import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiKeyStore } = vi.hoisted(() => {
  const store: { key: string | null } = { key: null }
  return { apiKeyStore: store }
})

vi.mock('./qunli-api-key-store', () => ({
  hasQunliApiKey: () => apiKeyStore.key !== null,
  getQunliApiKeyProtection: () => 'encrypted',
  saveQunliApiKey: (key: string) => {
    apiKeyStore.key = key
  },
  readQunliApiKey: () => apiKeyStore.key,
  clearQunliApiKey: () => {
    apiKeyStore.key = null
  },
  qunliApiKeyEnvelopeFile: () => ({ path: '/tmp/qunli', envelopePrefix: 'x' })
}))

import { _resetQunliClientCache, connect, getStatus } from './client'
import { _resetQunliMetadataCache, listTasks, updateTaskStatus } from './qunli-tasks'

const ACCOUNT = {
  id: 'acc-uuid',
  public_id: '2025',
  name: 'Jinshuju',
  task_statuses: [
    { id: 's-todo', name: '待处理', color: null, stage: 'todo', position: 1 },
    { id: 's-doing', name: '进行中', color: null, stage: 'in_progress', position: 2 },
    { id: 's-other', name: '验收中', color: null, stage: 'in_progress', position: 3 }
  ],
  task_type_statuses: [],
  task_types: [{ id: 't-bug', name: '缺陷', color: 'red', task_status_ids: ['s-todo', 's-doing'] }],
  priorities: [{ id: 'p-high', name: '高', color: null, position: 1 }]
}

const TASK = {
  id: 'task-uuid',
  public_id: 'T17810',
  title: '登录超时',
  app_url: '/2025/T17810',
  task_status_id: 's-todo',
  task_type_id: 't-bug',
  priority_id: 'p-high',
  project_id: 'proj-1',
  assignee_id: 'human-1',
  comments_count: 2
}

type Route = (url: URL, init: RequestInit) => unknown

function stubQunli(routes: Record<string, Route>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: URL, init: RequestInit) => {
    const url = new URL(String(input))
    const key = `${init.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`
    const route = routes[key]
    if (!route) {
      return Response.json({ title: `no route ${key}` }, { status: 404 })
    }
    return Response.json(route(url, init))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const viewerRoutes: Record<string, Route> = {
  'GET /user': () => ({ data: { id: 'agent-1', name: 'Orca 助手', kind: 'agent' } }),
  'GET /accounts': () => ({ data: [{ id: 'acc-uuid', public_id: '2025', name: 'Jinshuju' }] }),
  'GET /accounts/2025/users/agent-1': () => ({
    data: { id: 'agent-1', managed_by: { id: 'human-1', name: '熊健东' } }
  })
}

const metadataRoutes: Record<string, Route> = {
  'GET /accounts/2025': () => ({ data: ACCOUNT }),
  'GET /accounts/2025/projects': () => ({
    data: [{ id: 'proj-1', public_id: 'P1', name: 'goldendata' }]
  }),
  'GET /accounts/2025/users': () => ({ data: [{ id: 'human-1', name: '熊健东' }] })
}

describe('Qunli client', () => {
  beforeEach(() => {
    apiKeyStore.key = null
    _resetQunliClientCache()
    _resetQunliMetadataCache()
    vi.unstubAllGlobals()
  })

  it('connects with an agent key and treats its manager as the viewer', async () => {
    stubQunli(viewerRoutes)

    await expect(connect('  qk_secret ')).resolves.toEqual({
      ok: true,
      viewer: {
        agentId: 'agent-1',
        agentName: 'Orca 助手',
        accountId: '2025',
        accountName: 'Jinshuju',
        managerId: 'human-1',
        managerName: '熊健东'
      }
    })
    expect(apiKeyStore.key).toBe('qk_secret')
    await expect(getStatus()).resolves.toMatchObject({ connected: true })
  })

  it('does not store a key Qunli rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ detail: 'Invalid API key', code: 'unauthorized' }, { status: 401 })
      )
    )

    await expect(connect('bad')).resolves.toEqual({ ok: false, error: 'Invalid API key' })
    expect(apiKeyStore.key).toBeNull()
  })

  it('lists open tasks of the manager across pages with resolved names', async () => {
    apiKeyStore.key = 'qk'
    const pages: URL[] = []
    stubQunli({
      ...viewerRoutes,
      ...metadataRoutes,
      'GET /accounts/2025/tasks': (url) => {
        pages.push(url)
        const page = Number(url.searchParams.get('page'))
        return {
          data: page === 1 ? [TASK] : [{ ...TASK, id: 'task-2', public_id: 'T2' }],
          meta: { page, has_next: page === 1, total: 2, total_pages: 2 }
        }
      }
    })

    const { tasks, truncated } = await listTasks({ typeId: 't-bug' })

    expect(tasks.map((task) => task.ref)).toEqual(['T17810', 'T2'])
    expect(truncated).toBe(false)
    expect(tasks[0]).toMatchObject({
      url: 'https://qunli.co/2025/T17810',
      status: { name: '待处理' },
      type: { name: '缺陷' },
      priority: { name: '高' },
      project: { name: 'goldendata' },
      assignee: { name: '熊健东' }
    })
    expect(Object.fromEntries(pages[0].searchParams)).toMatchObject({
      assignee_id: 'human-1',
      task_type_id: 't-bug',
      finishing: 'not_finished'
    })
  })

  it('lists every member when the assignee filter is cleared and flags truncation', async () => {
    apiKeyStore.key = 'qk'
    const pages: URL[] = []
    stubQunli({
      ...viewerRoutes,
      ...metadataRoutes,
      'GET /accounts/2025/tasks': (url) => {
        pages.push(url)
        return { data: [TASK], meta: { page: 1, has_next: true, total: 900, total_pages: 9 } }
      }
    })

    const page = await listTasks({ assigneeId: null })

    expect(pages[0].searchParams.has('assignee_id')).toBe(false)
    expect(pages).toHaveLength(5)
    expect(page).toMatchObject({ total: 900, truncated: true })
  })

  it('refuses a status the task type does not allow', async () => {
    apiKeyStore.key = 'qk'
    const fetchMock = stubQunli({
      ...viewerRoutes,
      ...metadataRoutes,
      'GET /accounts/2025/tasks/T17810': () => ({ data: TASK })
    })

    await expect(updateTaskStatus('T17810', 's-other')).resolves.toMatchObject({
      ok: false,
      errorCode: 'qunli.statusNotAllowed'
    })
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })

  it('moves a task to an allowed status', async () => {
    apiKeyStore.key = 'qk'
    let body: unknown = null
    stubQunli({
      ...viewerRoutes,
      ...metadataRoutes,
      'GET /accounts/2025/tasks/T17810': () => ({ data: TASK }),
      'PATCH /accounts/2025/tasks/T17810': (_url, init) => {
        body = JSON.parse(String(init.body))
        return { data: { ...TASK, task_status_id: 's-doing' } }
      }
    })

    await expect(updateTaskStatus('T17810', 's-doing')).resolves.toMatchObject({
      ok: true,
      value: { status: { name: '进行中' } }
    })
    expect(body).toEqual({ task: { task_status_id: 's-doing' } })
  })
})
