import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceAttachment } from '../workspace-attachments/workspace-attachment-normalization'
import { parseWorkspaceReferenceUrl } from '../workspace-attachments/workspace-reference-identity'
import {
  normalizeQunliTaskListFilter,
  normalizeQunliTaskRef,
  parseQunliTaskUrl
} from './qunli-task-ref'

describe('Qunli task refs', () => {
  it('accepts card refs in any case and rejects other input', () => {
    expect(normalizeQunliTaskRef(' t17810 ')).toBe('T17810')
    expect(() => normalizeQunliTaskRef('ENG-1')).toThrow()
  })

  it('reads card links', () => {
    expect(parseQunliTaskUrl('https://qunli.co/2025/T17810')).toEqual({
      accountId: '2025',
      ref: 'T17810'
    })
    expect(parseQunliTaskUrl('https://example.com/2025/T17810')).toBeNull()
  })

  it('keeps an explicit null assignee and drops blank ids', () => {
    expect(normalizeQunliTaskListFilter({ assigneeId: null, projectId: ' ', typeId: 't' })).toEqual(
      {
        assigneeId: null,
        projectId: null,
        statusId: null,
        typeId: 't',
        finishing: 'not_finished'
      }
    )
  })

  it('turns a card link into a workspace reference', () => {
    expect(parseWorkspaceReferenceUrl('https://qunli.co/2025/T17810')).toEqual({
      provider: 'qunli',
      type: 'issue',
      number: 0,
      identifier: 'T17810',
      qunliIdentifier: 'T17810',
      url: 'https://qunli.co/2025/T17810'
    })
  })

  it('keeps number-0 Qunli attachments that carry a card ref', () => {
    expect(
      normalizeWorkspaceAttachment({
        provider: 'qunli',
        type: 'issue',
        number: 0,
        qunliIdentifier: 'T17810',
        url: 'https://qunli.co/2025/T17810'
      })
    ).toMatchObject({ provider: 'qunli', identifier: 'T17810' })
  })
})
