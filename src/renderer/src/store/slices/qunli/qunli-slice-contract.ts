import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { QunliConnectionStatus } from '../../../../../shared/qunli/qunli-types'
import type { QunliConnectResult } from '../../../../../preload/api/work-items/qunli-api'

export type QunliSlice = {
  qunliStatus: QunliConnectionStatus
  qunliStatusChecked: boolean
  qunliStatusContextKey: string | null
  checkQunliConnection: () => Promise<void>
  connectQunli: (apiKey: string) => Promise<QunliConnectResult>
  testQunliConnection: () => Promise<QunliConnectResult>
  disconnectQunli: () => Promise<void>
}

export type QunliStateCreator = StateCreator<AppState, [], [], QunliSlice>
