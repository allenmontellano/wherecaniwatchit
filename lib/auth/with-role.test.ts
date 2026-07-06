import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireRole = vi.fn()
vi.mock('@/lib/auth/guards', () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }))

import { withRole } from '@/lib/auth/with-role'
import type { SessionUser } from '@/lib/auth/guards'

const admin: SessionUser = { id: 'u1', email: 'a@b.c', role: 'admin', username: 'adm' }

beforeEach(() => requireRole.mockReset())

describe('withRole', () => {
  it('enforces the role, then calls the handler with the session user and args', async () => {
    requireRole.mockResolvedValueOnce(admin)
    const handler = vi.fn(async (user: SessionUser, a: number, b: string) => `${user.id}:${a}:${b}`)
    const action = withRole('admin', handler)

    const result = await action(7, 'x')

    expect(requireRole).toHaveBeenCalledWith('admin')
    expect(handler).toHaveBeenCalledWith(admin, 7, 'x')
    expect(result).toBe('u1:7:x')
  })

  it('supports an array of allowed roles', async () => {
    requireRole.mockResolvedValueOnce(admin)
    const action = withRole(['reviewer', 'admin'], async (u: SessionUser) => u.role)
    await action()
    expect(requireRole).toHaveBeenCalledWith(['reviewer', 'admin'])
  })

  it('does NOT call the handler when requireRole rejects (redirect throws)', async () => {
    requireRole.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
    const handler = vi.fn()
    const action = withRole('admin', handler)
    await expect(action()).rejects.toThrow('NEXT_REDIRECT')
    expect(handler).not.toHaveBeenCalled()
  })
})
