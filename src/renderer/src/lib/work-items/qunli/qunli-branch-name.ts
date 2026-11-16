import { slugifyForWorkspaceName } from '../../../../../shared/workspace/naming/workspace-name'

const PREFIX_RULES: readonly { prefix: string; pattern: RegExp }[] = [
  { prefix: 'fix', pattern: /缺陷|bug|故障|问题|修复|fix/i },
  { prefix: 'feat', pattern: /需求|功能|feature|story|feat/i }
]

/** Maps a card type to a flat branch prefix: 缺陷 → fix, 需求 → feat, anything else → chore. */
export function qunliBranchPrefix(typeName: string | null | undefined): string {
  return PREFIX_RULES.find((rule) => rule.pattern.test(typeName ?? ''))?.prefix ?? 'chore'
}

/** Flat names such as fix-17810-login-timeout; Chinese titles reduce to fix-17810. */
export function qunliTaskWorkspaceName(task: {
  ref: string
  title: string
  type?: { name: string } | null
}): string {
  const number = task.ref.replace(/^T/i, '')
  const subject = slugifyForWorkspaceName(task.title)
  return [qunliBranchPrefix(task.type?.name), number, subject]
    .filter(Boolean)
    .join('-')
    .slice(0, 64)
    .replace(/-+$/, '')
}
