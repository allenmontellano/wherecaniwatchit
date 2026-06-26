import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { mockGetUser, mockCreateServerClient } = vi.hoisted(() => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: null } })
  return {
    mockGetUser: getUser,
    mockCreateServerClient: vi.fn(() => ({ auth: { getUser } })),
  }
})
vi.mock('@supabase/ssr', () => ({ createServerClient: mockCreateServerClient }))

import { updateSession } from './proxy-session'

beforeEach(() => {
  mockGetUser.mockClear()
  mockCreateServerClient.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})

describe('updateSession', () => {
  it('refreshes the session and returns a NextResponse', async () => {
    const req = new NextRequest('http://localhost/account')
    const res = await updateSession(req)
    expect(mockCreateServerClient).toHaveBeenCalledOnce()
    expect(mockGetUser).toHaveBeenCalledOnce()
    expect(res).toBeInstanceOf(NextResponse)
  })
})
