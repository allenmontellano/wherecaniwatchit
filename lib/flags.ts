import type { FlagType } from '@/types/database'

export const ISSUE_TYPES = [
  'not-here',
  'is-here',
  'wrong-platform',
  'wrong-season',
  'other',
] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

const MAP: Record<IssueType, FlagType> = {
  'not-here': 'incorrect',
  'is-here': 'missing',
  'wrong-platform': 'incorrect',
  'wrong-season': 'outdated',
  other: 'incorrect',
}

export function issueToFlagType(issue: IssueType): FlagType {
  return MAP[issue]
}

export function composeNotes(
  issue: IssueType,
  platform: string | undefined,
  notes: string | undefined
): string | null {
  const parts: string[] = []
  if (platform?.trim()) parts.push(`Platform: ${platform.trim()}`)
  if (notes?.trim()) parts.push(notes.trim())
  return parts.length ? parts.join('\n') : null
}
