import { describe, expect, it } from 'vitest'
import { qunliTaskWorkspaceName } from './qunli-branch-name'

describe('qunliTaskWorkspaceName', () => {
  it('prefixes flat names by card type', () => {
    expect(
      qunliTaskWorkspaceName({ ref: 'T17810', title: '登录超时', type: { name: '缺陷' } })
    ).toBe('fix-17810')
    expect(
      qunliTaskWorkspaceName({ ref: 'T1', title: 'Export to Excel', type: { name: '需求' } })
    ).toBe('feat-1-export-to-excel')
    expect(qunliTaskWorkspaceName({ ref: 'T2', title: '升级依赖', type: { name: '任务' } })).toBe(
      'chore-2'
    )
  })
})
