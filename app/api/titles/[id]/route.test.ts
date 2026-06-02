import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

import { GET } from './route'

describe('GET /api/titles/[id]', () => {
  it('returns 404 when title is not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'titles') {
        return {
          select: () => ({
            eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }),
          }),
        }
      }
      return {}
    })

    const req = new NextRequest('http://localhost:3000/api/titles/nonexistent')
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 200 with title and availability on success', async () => {
    const mockTitle = { id: 'uuid', tmdb_id: 27205, title: 'Inception', type: 'movie', genres: [], runtime: 148, release_year: 2010, synopsis: null, poster_url: null, imdb_rating: 8.4, imdb_id: null, season_count: null, created_at: '', updated_at: '' }
    const mockAvailability = [{ id: 'avail-uuid', region_code: 'US', available: true, platform: { name: 'Netflix' } }]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'titles') {
        return {
          select: () => ({
            eq: () => ({ single: () => ({ data: mockTitle, error: null }) }),
          }),
        }
      }
      if (table === 'availability') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({ data: mockAvailability, error: null }),
              }),
            }),
          }),
        }
      }
      return {}
    })

    const req = new NextRequest('http://localhost:3000/api/titles/uuid')
    const res = await GET(req, { params: Promise.resolve({ id: 'uuid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title.title).toBe('Inception')
    expect(body.availability).toHaveLength(1)
  })
})
