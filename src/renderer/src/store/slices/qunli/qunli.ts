import {
  qunliConnect,
  qunliDisconnect,
  qunliStatus,
  qunliTestConnection
} from '@/runtime/qunli/runtime-qunli-client'
import { getProviderRuntimeContextKey } from '@/runtime/hosts/observations/provider-runtime-context'
import { defaultScopeSource } from '@/runtime/hosts/selection/default-creation-host'
import type { QunliSlice, QunliStateCreator } from './qunli-slice-contract'

const DISCONNECTED: QunliSlice['qunliStatus'] = { connected: false, viewer: null }

export const createQunliSlice: QunliStateCreator = (set, get) => {
  const refreshStatus = async (): Promise<void> => {
    const contextKey = getProviderRuntimeContextKey(get().settings)
    try {
      const status = await qunliStatus(defaultScopeSource(get().settings))
      if (getProviderRuntimeContextKey(get().settings) === contextKey) {
        set({ qunliStatus: status, qunliStatusChecked: true, qunliStatusContextKey: contextKey })
      }
    } catch (error) {
      if (getProviderRuntimeContextKey(get().settings) === contextKey) {
        set({
          qunliStatus: {
            ...DISCONNECTED,
            credentialError: error instanceof Error ? error.message : String(error)
          },
          qunliStatusChecked: true,
          qunliStatusContextKey: contextKey
        })
      }
    }
  }

  return {
    qunliStatus: DISCONNECTED,
    qunliStatusChecked: false,
    qunliStatusContextKey: null,
    checkQunliConnection: async () => {
      if (get().qunliStatusContextKey !== getProviderRuntimeContextKey(get().settings)) {
        set({ qunliStatusChecked: false })
      }
      await refreshStatus()
    },
    connectQunli: async (apiKey) => {
      const result = await qunliConnect(defaultScopeSource(get().settings), apiKey)
      if (result.ok) {
        await refreshStatus()
      }
      return result
    },
    testQunliConnection: async () => {
      const result = await qunliTestConnection(defaultScopeSource(get().settings))
      await refreshStatus()
      return result
    },
    disconnectQunli: async () => {
      await qunliDisconnect(defaultScopeSource(get().settings))
      set({ qunliStatus: DISCONNECTED })
      await refreshStatus()
    }
  }
}
