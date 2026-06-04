import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Title } from '@/types/database'
import type { SyncedResult } from '@/types/search'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}))
vi.mock('@/lib/search-db', () => ({ searchLocalTitles: vi.fn() }))
vi.mock('@/lib/tmdb/client', () => ({ searchTMDB: vi.fn() }))
vi.mock('@/lib/sync', () => ({ syncTitle: vi.fn() }))
vi.mock('@/lib/quota', () => ({ hasRemainingQuota: vi.fn() }))

import { GET } from './route'
import { searchLocalTitles } from '@/lib/search-db'
import { searchTMDB } from '@/lib/tmdb/client'
import { syncTitle } from '@/lib/sync'
import { hasRemainingQuota } from '@/lib/quota'

function makeTitle(over: Partial<Title> = {}): Title {
  return {
    id: 'uuid', tmdb_id: 1, title: 'Inception', type: 'movie', genres: [], runtime: null,
    release_year: null, synopsis: null, poster_url: null, imdb_rating: null, imdb_id: null,
    season_count: null, network: null, cast: null, creators: null, origin_country: null,
    episode_count: null, status: null, original_language: null, content_rating: null,
    created_at: '', updated_at: '', ...over,
  }
}

const syncedResult = (t: Title): SyncedResult => ({ title: t, availabilityByRegion: { US: ['netflix'] } })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/search — validation', () => {
  it('returns 400 when q is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/search'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when q is a single character', async () => {
    const res = await GET(new NextRequest('http://localhost/api/search?q=a'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when q exceeds 200 characters', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/search?q=${'a'.repeat(201)}`))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/search — DB-first', () => {
  it('returns DB results without calling TMDB or MOTN when found locally', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([syncedResult(makeTitle())])

    const res = await GET(new NextRequest('http://localhost/api/search?q=inception'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results).toHaveLength(1)
    expect(searchTMDB).not.toHaveBeenCalled()
    expect(syncTitle).not.toHaveBeenCalled()
  })
})

describe('GET /api/search — on-demand', () => {
  it('returns empty results when neither DB nor TMDB have the title', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([])

    const res = await GET(new NextRequest('http://localhost/api/search?q=zzzznope'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results).toEqual([])
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('does not call MOTN when quota is exhausted, returns a notice', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([
      { id: 1, media_type: 'movie', title: 'Inception', overview: '', poster_path: null, vote_average: 8, genre_ids: [] },
    ])
    vi.mocked(hasRemainingQuota).mockResolvedValueOnce(false)

    const res = await GET(new NextRequest('http://localhost/api/search?q=inception'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results).toEqual([])
    expect(body.notice).toMatch(/soon/i)
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('seeds on-demand via syncTitle when quota is available', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([
      { id: 1, media_type: 'movie', title: 'Inception', overview: '', poster_path: null, vote_average: 8, genre_ids: [] },
    ])
    vi.mocked(hasRemainingQuota).mockResolvedValueOnce(true)
    vi.mocked(syncTitle).mockResolvedValueOnce(syncedResult(makeTitle()))

    const res = await GET(new NextRequest('http://localhost/api/search?q=inception'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results).toHaveLength(1)
    expect(syncTitle).toHaveBeenCalledTimes(1)
  })

  it('returns a friendly notice (not a 500) when the local lookup throws', async () => {
    vi.mocked(searchLocalTitles).mockRejectedValueOnce(new Error('db down'))

    const res = await GET(new NextRequest('http://localhost/api/search?q=inception'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.results).toEqual([])
    expect(body.notice).toMatch(/trouble/i)
  })
})
