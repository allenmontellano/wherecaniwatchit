import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateClient } = vi.hoisted(() => ({ mockCreateClient: vi.fn() }))
const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error('REDIRECT:' + url)
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import { getSessionUser, requireUser, requireRole } from './guards'

type ProfileRow = { username: string; role: string } | null

function stubClient(user: { id: string; email?: string } | null, profile: ProfileRow) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: profile, error: profile ? null : { code: 'PGRST116' } }),
        })),
      })),
    })),
  }
}

beforeEach(() => {
  mockCreateClient.mockReset()
  mockRedirect.mockClear()
})

describe('getSessionUser', () => {
  it('returns null when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(stubClient(null, null))
    expect(await getSessionUser()).toBeNull()
  })
  it('returns the session user with role when profile is valid', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'reviewer' })
    )
    expect(await getSessionUser()).toEqual({ id: 'u1', email: 'a@b.co', role: 'reviewer', username: 'ann' })
  })
  it('returns null when the profile role is invalid', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'wizard' })
    )
    expect(await getSessionUser()).toBeNull()
  })
})

describe('requireUser', () => {
  it('redirects to /login when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(stubClient(null, null))
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
  it('returns the user when authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'admin' })
    )
    expect((await requireUser()).role).toBe('admin')
  })
})

describe('requireRole', () => {
  it('redirects to /account when the role is not permitted', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'contributor' })
    )
    await expect(requireRole('admin')).rejects.toThrow('REDIRECT:/account')
  })
  it('allows when the role is in the permitted list', async () => {
    mockCreateClient.mockResolvedValue(
      stubClient({ id: 'u1', email: 'a@b.co' }, { username: 'ann', role: 'reviewer' })
    )
    expect((await requireRole(['reviewer', 'admin'])).username).toBe('ann')
  })
})
