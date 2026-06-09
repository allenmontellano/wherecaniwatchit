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

  it('returns 400 when q exceeds 100 characters', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/search?q=${'a'.repeat(101)}`))
    expect(res.status).toBe(400)
    expect(performSearch).not.toHaveBeenCalled()
  })

  it('processes a query at exactly 100 characters', async () => {
    vi.mocked(performSearch).mockResolvedValueOnce({ results: [], query: 'x', source: 'db' })
    const res = await GET(new NextRequest(`http://localhost/api/search?q=${'a'.repeat(100)}`))
    expect(res.status).toBe(200)
    expect(performSearch).toHaveBeenCalled()
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

  it('sets a cacheable Cache-Control header for good results', async () => {
    vi.mocked(performSearch).mockResolvedValueOnce({
      results: [{ id: '1' }] as never,
      query: 'inception',
      source: 'db',
    })
    const res = await GET(new NextRequest('http://localhost/api/search?q=inception'))
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=3600',
    )
  })

  it('sets no-store when results are empty', async () => {
    vi.mocked(performSearch).mockResolvedValueOnce({ results: [], query: 'zzz', source: 'db' })
    const res = await GET(new NextRequest('http://localhost/api/search?q=zzz'))
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('sets no-store when the response carries a notice', async () => {
    vi.mocked(performSearch).mockResolvedValueOnce({
      results: [{ id: '1' }] as never,
      query: 'dune',
      source: 'tmdb',
      notice: 'Finding streaming availability — refresh in a moment.',
    })
    const res = await GET(new NextRequest('http://localhost/api/search?q=dune'))
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('sets no-store on error source', async () => {
    vi.mocked(performSearch).mockResolvedValueOnce({
      results: [{ id: '1' }] as never,
      query: 'dune',
      source: 'error',
    })
    const res = await GET(new NextRequest('http://localhost/api/search?q=dune'))
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
