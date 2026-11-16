import {
  normalizeQunliTaskListFilter,
  normalizeQunliTaskRef
} from '../../../../../../shared/qunli/qunli-task-ref'
import {
  QunliConnect,
  QunliListTasks,
  QunliMetadata,
  QunliTaskRef,
  QunliUpdateTaskStatus
} from '../../../../../../shared/rpc-contract/qunli/qunli-params'
import { defineMethod } from '../../../core'

export const QUNLI_METHODS = [
  defineMethod({
    name: 'qunli.connect',
    permission: 'accounts-admin',
    params: QunliConnect,
    handler: async (params, { runtime }) => runtime.qunliConnect(params.apiKey.trim())
  }),
  defineMethod({
    name: 'qunli.disconnect',
    permission: 'accounts-admin',
    params: null,
    handler: async (_params, { runtime }) => runtime.qunliDisconnect()
  }),
  defineMethod({
    name: 'qunli.status',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.qunliStatus()
  }),
  defineMethod({
    name: 'qunli.testConnection',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.qunliTestConnection()
  }),
  defineMethod({
    name: 'qunli.metadata',
    permission: 'workspace',
    params: QunliMetadata,
    handler: async (params, { runtime }) => runtime.qunliMetadata(params?.force)
  }),
  defineMethod({
    name: 'qunli.listTasks',
    permission: 'workspace',
    params: QunliListTasks,
    handler: async (params, { runtime }) =>
      runtime.qunliListTasks(normalizeQunliTaskListFilter(params?.filter))
  }),
  defineMethod({
    name: 'qunli.getTask',
    permission: 'workspace',
    params: QunliTaskRef,
    handler: async (params, { runtime }) => runtime.qunliGetTask(normalizeQunliTaskRef(params.ref))
  }),
  defineMethod({
    name: 'qunli.taskComments',
    permission: 'workspace',
    params: QunliTaskRef,
    handler: async (params, { runtime }) =>
      runtime.qunliTaskComments(normalizeQunliTaskRef(params.ref))
  }),
  defineMethod({
    name: 'qunli.updateTaskStatus',
    permission: 'workspace',
    params: QunliUpdateTaskStatus,
    handler: async (params, { runtime }) =>
      runtime.qunliUpdateTaskStatus(normalizeQunliTaskRef(params.ref), params.statusId.trim())
  })
]
