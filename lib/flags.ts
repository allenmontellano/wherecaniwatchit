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

export type SanitizeResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

export function sanitizeWatchUrl(raw: string | undefined | null): SanitizeResult {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return { ok: true, value: null }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Invalid watch URL.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Invalid watch URL.' }
  }
  const sanitized = url.origin + url.pathname
  if (sanitized.length > 500) return { ok: false, error: 'Invalid watch URL.' }
  return { ok: true, value: sanitized }
}
