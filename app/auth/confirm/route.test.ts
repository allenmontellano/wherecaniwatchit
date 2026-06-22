import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockVerifyOtp, mockCreateClient, mockRedirect } = vi.hoisted(() => {
  const verifyOtp = vi.fn()
  return {
    mockVerifyOtp: verifyOtp,
    mockCreateClient: vi.fn(async () => ({ auth: { verifyOtp } })),
    mockRedirect: vi.fn((url: string) => {
      throw new Error('REDIRECT:' + url)
    }),
  }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import { GET } from './route'

const req = (url: string) => new Request(url)

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyOtp.mockResolvedValue({ error: null })
})

describe('GET /auth/confirm', () => {
  it('verifies the token and redirects to next on success', async () => {
    await expect(GET(req('https://x.io/auth/confirm?token_hash=abc&type=invite&next=/accept-invite')))
      .rejects.toThrow('REDIRECT:/accept-invite')
    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'abc' })
  })
  it('defaults next to /account when absent', async () => {
    await expect(GET(req('https://x.io/auth/confirm?token_hash=abc&type=invite')))
      .rejects.toThrow('REDIRECT:/account')
  })
  it('rejects an absolute-URL next (open-redirect guard)', async () => {
    await expect(GET(req('https://x.io/auth/confirm?token_hash=abc&type=invite&next=https://evil.com')))
      .rejects.toThrow('REDIRECT:/account')
  })
  it('rejects a protocol-relative next', async () => {
    await expect(GET(req('https://x.io/auth/confirm?token_hash=abc&type=invite&next=//evil.com')))
      .rejects.toThrow('REDIRECT:/account')
  })
  it('rejects a backslash-relative next', async () => {
    await expect(GET(req('https://x.io/auth/confirm?token_hash=abc&type=invite&next=/\\evil.com')))
      .rejects.toThrow('REDIRECT:/account')
  })
  it('redirects to /login on verify error', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'bad' } })
    await expect(GET(req('https://x.io/auth/confirm?token_hash=abc&type=invite')))
      .rejects.toThrow('REDIRECT:/login?error=invalid_link')
  })
  it('redirects to /login when token_hash is missing (no verify attempt)', async () => {
    await expect(GET(req('https://x.io/auth/confirm?type=invite')))
      .rejects.toThrow('REDIRECT:/login?error=invalid_link')
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })
})
