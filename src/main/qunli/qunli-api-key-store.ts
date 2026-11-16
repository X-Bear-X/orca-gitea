import { createEncryptedApiKeyFileStore } from '../credentials/encrypted-api-key-file-store'

const store = createEncryptedApiKeyFileStore({
  fileName: 'qunli-api-key.enc',
  envelopePrefix: 'orca-qunli-api-key:v1:',
  providerLabel: 'Qunli',
  logScope: 'qunli'
})

export const hasQunliApiKey = store.has
export const getQunliApiKeyProtection = store.protection
export const saveQunliApiKey = store.save
export const readQunliApiKey = store.read
export const clearQunliApiKey = store.clear
export const qunliApiKeyEnvelopeFile = store.envelopeFile
