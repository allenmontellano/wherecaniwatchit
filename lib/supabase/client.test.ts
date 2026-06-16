import { describe, it, expect } from 'vitest'

describe('createClient (browser)', () => {
  it('imports createClient without error', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    // This should not throw
    const { createClient } = require('./client')
    expect(typeof createClient).toBe('function')
  })
})
