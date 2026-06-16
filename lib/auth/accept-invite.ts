import { isUserRole, type UserRole } from '@/lib/auth/roles'

export interface AcceptInviteValue {
  username: string
  password: string
  regionCode: string | null
}

export type AcceptInviteParse =
  | { ok: true; value: AcceptInviteValue }
  | { ok: false; error: string }

const USERNAME_RE = /^[A-Za-z0-9_]+$/

export function parseAcceptInviteInput(input: {
  username: string
  password: string
  regionCode: string
}): AcceptInviteParse {
  const username = input.username.trim()
  const regionCode = input.regionCode.trim() === '' ? null : input.regionCode.trim()

  if (username.length < 3 || username.length > 30) {
    return { ok: false, error: 'Username must be 3–30 characters.' }
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: 'Username may only contain letters, numbers, and underscores.' }
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  return { ok: true, value: { username, password: input.password, regionCode } }
}

export function resolveInviteRole(appMetadata: unknown): UserRole {
  if (appMetadata && typeof appMetadata === 'object') {
    const role = (appMetadata as Record<string, unknown>).role
    if (isUserRole(role)) return role
  }
  return 'contributor'
}
