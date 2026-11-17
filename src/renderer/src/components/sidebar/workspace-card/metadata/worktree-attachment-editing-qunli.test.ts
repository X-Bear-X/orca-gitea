import { describe, expect, it } from 'vitest'

import { parseWorkspaceAttachmentInput } from './worktree-attachment-editing'

const CARD = {
  provider: 'qunli',
  type: 'issue',
  number: 0,
  identifier: 'T18430',
  qunliIdentifier: 'T18430',
  url: 'https://qunli.co/2025/T18430'
}

describe('Qunli workspace links', () => {
  it('links a pasted card URL whatever reference type is selected', () => {
    expect(parseWorkspaceAttachmentInput('https://qunli.co/2025/T18430', 'github-pr')).toEqual(CARD)
  })

  it('links a bare card number under the connected team', () => {
    expect(parseWorkspaceAttachmentInput('t18430', 'qunli-task', '2025')).toEqual(CARD)
    expect(parseWorkspaceAttachmentInput('18430', 'qunli-task', '2025')).toEqual(CARD)
    expect(parseWorkspaceAttachmentInput('ENG-1', 'qunli-task')).toBeNull()
  })
})
