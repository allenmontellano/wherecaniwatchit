import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/tmdb/client', () => ({ searchTMDB: vi.fn() }))
vi.mock('@/lib/sync', () => ({ syncTitle: vi.fn() }))

import { GET } from './route'
import { searchTMDB } from '@/lib/tmdb/client'
import { syncTitle } from '@/lib/sync'

describe('GET /api/search', () => {
  it('returns 400 when q is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/search')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/at least 2 characters/i)
  })

  it('returns 400 when q is a single character', async () => {
    const req = new NextRequest('http://localhost:3000/api/search?q=a')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when q exceeds 200 characters', async () => {
    const longQuery = 'a'.repeat(201)
    const req = new NextRequest(`http://localhost:3000/api/search?q=${longQuery}`)
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too long/i)
  })

  it('returns 200 with results on a valid query', async () => {
    vi.mocked(searchTMDB).mockResolvedValueOnce([
      { id: 27205, media_type: 'movie', title: 'Inception', overview: '', poster_path: null, vote_average: 8.4, genre_ids: [] },
    ])
    vi.mocked(syncTitle).mockResolvedValueOnce({
      title: { id: 'uuid', tmdb_id: 27205, title: 'Inception', type: 'movie', genres: [], runtime: 148, release_year: 2010, synopsis: null, poster_url: null, imdb_rating: 8.4, imdb_id: null, season_count: null, network: null, cast: null, creators: null, origin_country: null, episode_count: null, status: null, original_language: null, content_rating: null, created_at: '', updated_at: '' },
      availabilityByRegion: { US: ['netflix'] },
    })

    const req = new NextRequest('http://localhost:3000/api/search?q=inception')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.query).toBe('inception')
  })
})
