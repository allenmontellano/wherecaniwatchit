import { requireRole, type SessionUser } from '@/lib/auth/guards'
import type { UserRole } from '@/lib/auth/roles'

// SEC-02: the single enforced entry point for privileged Server Actions.
// Every admin action is defined as `export const x = withRole(role, handler)`
// so authorization can never be forgotten and can be checked in CI. The wrapped
// handler receives the authenticated SessionUser as its first argument; the
// returned action keeps the handler's remaining arguments and return type.
export function withRole<Args extends unknown[], R>(
  roles: UserRole | UserRole[],
  handler: (user: SessionUser, ...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    const user = await requireRole(roles)
    return handler(user, ...args)
  }
}
