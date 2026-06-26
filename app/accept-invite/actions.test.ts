import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockServerClient, mockAdminClient, mockRedirect } = vi.hoisted(() => ({
  mockServerClient: { auth: { getUser: vi.fn(), updateUser: vi.fn() } },
  mockAdminClient: { from: vi.fn() },
  mockRedirect: vi.fn((url: string) => {
    throw new Error('REDIRECT:' + url)
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockServerClient) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdminClient }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import { acceptInvite } from './actions'

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mockServerClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'reviewer' } } },
  })
  mockServerClient.auth.updateUser.mockResolvedValue({ error: null })
})

describe('acceptInvite', () => {
  it('returns a validation error without touching the DB', async () => {
    const result = await acceptInvite(form({ username: 'no', password: 'longenough', regionCode: '' }))
    expect(result).toEqual({ error: 'Username must be 3–30 characters.' })
    expect(mockAdminClient.from).not.toHaveBeenCalled()
  })

  it('returns "username taken" on a unique violation', async () => {
    mockAdminClient.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { code: '23505' } }),
    })
    const result = await acceptInvite(form({ username: 'taken', password: 'longenough', regionCode: '' }))
    expect(result).toEqual({ error: 'That username is already taken.' })
  })

  it('inserts the profile with the invited role then redirects', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockAdminClient.from.mockReturnValue({ insert })
    await expect(acceptInvite(form({ username: 'ann', password: 'longenough', regionCode: 'PH' })))
      .rejects.toThrow('REDIRECT:/account')
    expect(mockServerClient.auth.updateUser).toHaveBeenCalledWith({ password: 'longenough' })
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1',
      username: 'ann',
      region_code: 'PH',
      role: 'reviewer',
    })
  })
})
