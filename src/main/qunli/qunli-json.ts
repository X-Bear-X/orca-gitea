export type JsonRecord = Record<string, unknown>

export function asRecord(value: unknown): JsonRecord | null {
  return isJsonRecord(value) ? value : null
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isJsonRecord) : []
}

export function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() ? value : null
  }
  return typeof value === 'number' ? String(value) : null
}
