import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_QUNLI_LIST_PREFERENCES,
  readQunliListPreferences,
  writeQunliListPreferences
} from './qunli-list-preferences'

function stubStorage(): Map<string, string> {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  })
  return values
}

describe('Qunli list preferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores the filters and sort chosen last time', () => {
    stubStorage()
    const chosen = {
      ...DEFAULT_QUNLI_LIST_PREFERENCES,
      assignee: 'all',
      projectId: 'proj-1',
      finishing: 'finished' as const,
      sortBy: 'priority' as const,
      sortDirection: 'asc' as const
    }

    writeQunliListPreferences(chosen)

    expect(readQunliListPreferences()).toEqual(chosen)
  })

  it('falls back to my open cards for missing or damaged values', () => {
    const values = stubStorage()
    values.set(
      'orca.qunli.list-preferences.v1',
      JSON.stringify({ assignee: '', finishing: 'soon', sortBy: 'nope' })
    )

    expect(readQunliListPreferences()).toEqual(DEFAULT_QUNLI_LIST_PREFERENCES)
  })
})
