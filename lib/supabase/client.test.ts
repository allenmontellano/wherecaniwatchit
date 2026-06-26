import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateBrowserClient } = vi.hoisted(() => ({
  mockCreateBrowserClient: vi.fn(() => ({ tag: 'browser-client' })),
}))
vi.mock('@supabase/ssr', () => ({ createBrowserClient: mockCreateBrowserClient }))

import { createClient } from './client'

beforeEach(() => {
  mockCreateBrowserClient.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})

describe('createClient (browser)', () => {
  it('builds a browser client from the public env vars', () => {
    const client = createClient()
    expect(mockCreateBrowserClient).toHaveBeenCalledWith('https://proj.supabase.co', 'anon-key')
    expect(client).toEqual({ tag: 'browser-client' })
  })
})
