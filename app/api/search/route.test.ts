import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/search')>()),
  performSearch: vi.fn(),
}))

import { GET } from './route'
import { performSearch } from '@/lib/search'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/search', () => {
  it('returns 400 when q is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/search'))
    expect(res.status).toBe(400)
    expect(performSearch).not.toHaveBeenCalled()
  })

  it('returns 400 when q is a single character', async () => {
    const res = await GET(new NextRequest('http://localhost/api/search?q=a'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when q exceeds 200 characters', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/search?q=${'a'.repeat(201)}`))
    expect(res.status).toBe(400)
  })

  it('delegates to performSearch and returns its result as JSON', async () => {
    vi.mocked(performSearch).mockResolvedValueOnce({
      results: [],
      query: 'inception',
      source: 'db',
    })

    const res = await GET(new NextRequest('http://localhost/api/search?q=inception'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(performSearch).toHaveBeenCalledWith('inception')
    expect(body.query).toBe('inception')
    expect(body.source).toBe('db')
  })
})
