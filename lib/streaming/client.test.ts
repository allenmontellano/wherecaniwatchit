import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

process.env.MOTN_API_KEY = 'test-motn-key'

vi.mock('@/lib/quota', () => ({
  incrementQuota: vi.fn().mockResolvedValue(1),
}))

import { fetchShowByTMDBId, LAUNCH_REGIONS } from './client'
import { incrementQuota } from '@/lib/quota'
import type { SAShow } from './types'

beforeEach(() => {
  mockFetch.mockReset()
  vi.mocked(incrementQuota).mockClear()
})

const mockShow: SAShow = {
  itemType: 'show',
  showType: 'movie',
  id: 'tmdb:movie:27205',
  imdbId: 'tt1375666',
  tmdbId: '27205',
  title: 'Inception',
  overview: 'A thief...',
  releaseYear: 2010,
  genres: [{ id: 'action', name: 'Action' }],
  imageSet: {},
  streamingOptions: {
    us: [
      {
        service: { id: 'netflix', name: 'Netflix', homePage: 'https://netflix.com', imageSet: { lightThemeImage: '', darkThemeImage: '' } },
        type: 'subscription',
        link: 'https://netflix.com/watch/12345',
        expiresSoon: false,
      },
    ],
    ph: [], gb: [], au: [], ca: [],
  },
}

describe('LAUNCH_REGIONS', () => {
  it('includes all five launch regions in lowercase', () => {
    expect(LAUNCH_REGIONS).toEqual(expect.arrayContaining(['ph', 'us', 'gb', 'au', 'ca']))
    expect(LAUNCH_REGIONS).toHaveLength(5)
  })
})

describe('fetchShowByTMDBId', () => {
  it('requests the correct SA API endpoint for a movie', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockShow })

    await fetchShowByTMDBId(27205, 'movie')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('api.movieofthenight.com/v4')
    expect(calledUrl).toContain('/shows/movie/27205')
    expect(calledUrl).toContain('output_language=en')
  })

  it('requests the correct SA API endpoint for a TV show', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...mockShow, showType: 'series' }) })

    await fetchShowByTMDBId(66732, 'tv')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/shows/tv/66732')
  })

  it('sends the MOTN API key in X-API-Key header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockShow })

    await fetchShowByTMDBId(27205, 'movie')

    const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
    expect(calledHeaders['X-API-Key']).toBe('test-motn-key')
  })

  it('returns null for a 404 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    const result = await fetchShowByTMDBId(99999, 'movie')

    expect(result).toBeNull()
  })

  it('throws for non-404 error responses', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })

    await expect(fetchShowByTMDBId(27205, 'movie')).rejects.toThrow(
      'Streaming Availability API failed: 429'
    )
  })

  it('returns the show with streamingOptions', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockShow })

    const result = await fetchShowByTMDBId(27205, 'movie')

    expect(result?.title).toBe('Inception')
    expect(result?.streamingOptions.us).toHaveLength(1)
    expect(result?.streamingOptions.us[0].service.id).toBe('netflix')
  })
})

describe('fetchShowByTMDBId quota counting', () => {
  it('increments the MOTN quota counter once on a successful call', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockShow })

    await fetchShowByTMDBId(27205, 'movie')

    expect(incrementQuota).toHaveBeenCalledTimes(1)
    expect(incrementQuota).toHaveBeenCalledWith('motn')
  })

  it('increments the counter on a 404 — the lookup still consumed a call', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    await fetchShowByTMDBId(99999, 'movie')

    expect(incrementQuota).toHaveBeenCalledTimes(1)
  })

  it('increments the counter on an error response before throwing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })

    await expect(fetchShowByTMDBId(27205, 'movie')).rejects.toThrow()

    expect(incrementQuota).toHaveBeenCalledTimes(1)
  })

  it('does not increment when fetch itself throws (no response received)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))

    await expect(fetchShowByTMDBId(27205, 'movie')).rejects.toThrow('network down')

    expect(incrementQuota).not.toHaveBeenCalled()
  })
})
