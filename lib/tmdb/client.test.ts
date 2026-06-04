import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch before importing the module under test
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Set env var before importing
process.env.TMDB_API_KEY = 'test-api-key'

import { searchTMDB, fetchMovieDetail, fetchTVDetail, posterUrl } from './client'
import type { TMDBSearchResult, TMDBMovieDetail, TMDBTVDetail } from './types'

beforeEach(() => {
  mockFetch.mockReset()
})

describe('posterUrl', () => {
  it('returns full TMDB image URL for a poster path', () => {
    expect(posterUrl('/abc123.jpg')).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg')
  })

  it('returns null when poster path is null', () => {
    expect(posterUrl(null)).toBeNull()
  })
})

describe('searchTMDB', () => {
  it('calls TMDB multi-search with the query and api_key', async () => {
    const results: TMDBSearchResult[] = [
      { id: 27205, media_type: 'movie', title: 'Inception', overview: '', poster_path: null, vote_average: 8.4, genre_ids: [28] },
      { id: 999, media_type: 'person', title: 'Someone', overview: '', poster_path: null, vote_average: 0, genre_ids: [] } as unknown as TMDBSearchResult,
    ]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results }),
    })

    await searchTMDB('inception')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/search/multi')
    expect(calledUrl).toContain('query=inception')
    expect(calledUrl).toContain('api_key=test-api-key')
  })

  it('filters out non-movie and non-tv results', async () => {
    const results: TMDBSearchResult[] = [
      { id: 1, media_type: 'movie', title: 'A Movie', overview: '', poster_path: null, vote_average: 7, genre_ids: [] },
      { id: 2, media_type: 'person', title: 'A Person', overview: '', poster_path: null, vote_average: 0, genre_ids: [] } as unknown as TMDBSearchResult,
      { id: 3, media_type: 'tv', name: 'A Show', overview: '', poster_path: null, vote_average: 8, genre_ids: [] },
    ]
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results }) })

    const found = await searchTMDB('test')

    expect(found).toHaveLength(2)
    expect(found.map((r) => r.media_type)).toEqual(['movie', 'tv'])
  })

  it('throws when TMDB returns a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    await expect(searchTMDB('test')).rejects.toThrow('TMDB search failed with status 401')
  })
})

describe('fetchMovieDetail', () => {
  it('fetches movie detail by TMDB ID', async () => {
    const detail: TMDBMovieDetail = {
      id: 27205, imdb_id: 'tt1375666', title: 'Inception',
      overview: 'A thief...', poster_path: '/poster.jpg',
      release_date: '2010-07-16', vote_average: 8.4, runtime: 148,
      genres: [{ id: 28, name: 'Action' }],
    }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => detail })

    const result = await fetchMovieDetail(27205)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/movie/27205')
    expect(result.title).toBe('Inception')
    expect(result.runtime).toBe(148)
  })
})

describe('fetchTVDetail', () => {
  it('fetches TV detail with external_ids appended', async () => {
    const detail: TMDBTVDetail = {
      id: 66732, name: 'Stranger Things', overview: 'Kids vs monsters',
      poster_path: '/st.jpg', first_air_date: '2016-07-15',
      vote_average: 8.7, number_of_seasons: 4,
      genres: [{ id: 18, name: 'Drama' }],
      external_ids: { imdb_id: 'tt4574334' },
    }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => detail })

    const result = await fetchTVDetail(66732)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/tv/66732')
    expect(calledUrl).toContain('append_to_response=external_ids')
    expect(result.number_of_seasons).toBe(4)
    expect(result.external_ids.imdb_id).toBe('tt4574334')
  })
})
