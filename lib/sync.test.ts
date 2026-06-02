import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TMDBSearchResult } from './tmdb/types'
import type { SAShow } from './streaming/types'

// --- mocks ---
vi.mock('./tmdb/client', () => ({
  fetchMovieDetail: vi.fn(),
  fetchTVDetail: vi.fn(),
  posterUrl: (path: string | null) => (path ? `https://image.tmdb.org/t/p/w500${path}` : null),
}))

vi.mock('./streaming/client', () => ({
  fetchShowByTMDBId: vi.fn(),
  LAUNCH_REGIONS: ['ph', 'us', 'gb', 'au', 'ca'],
}))

const mockFrom = vi.fn()

vi.mock('./supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

import { syncTitle } from './sync'
import { fetchMovieDetail, fetchTVDetail } from './tmdb/client'
import { fetchShowByTMDBId } from './streaming/client'

const movieResult: TMDBSearchResult = {
  id: 27205, media_type: 'movie', title: 'Inception',
  overview: '', poster_path: '/inc.jpg', vote_average: 8.4, genre_ids: [28],
}

const mockMovieDetail = {
  id: 27205, imdb_id: 'tt1375666', title: 'Inception',
  overview: 'A thief infiltrates dreams.', poster_path: '/inc.jpg',
  release_date: '2010-07-16', vote_average: 8.4, runtime: 148,
  genres: [{ id: 28, name: 'Action' }],
}

const mockSAShow: SAShow = {
  itemType: 'show', showType: 'movie', id: 'tmdb:movie:27205',
  imdbId: 'tt1375666', tmdbId: '27205', title: 'Inception', overview: '',
  releaseYear: 2010, genres: [], imageSet: {},
  streamingOptions: {
    us: [{
      service: { id: 'netflix', name: 'Netflix', homePage: '', imageSet: { lightThemeImage: '', darkThemeImage: '' } },
      type: 'subscription', link: '', expiresSoon: false,
    }],
    ph: [], gb: [], au: [], ca: [],
  },
}

const mockPlatforms = [
  { id: 'plat-netflix-uuid', name: 'Netflix', slug: 'netflix', logo_url: null, supported_regions: ['US', 'PH', 'GB', 'AU', 'CA'], created_at: '' },
]

const mockUpsertedTitle = {
  id: 'title-uuid', tmdb_id: 27205, title: 'Inception', type: 'movie',
  genres: ['Action'], runtime: 148, release_year: 2010,
  synopsis: 'A thief infiltrates dreams.', poster_url: 'https://image.tmdb.org/t/p/w500/inc.jpg',
  imdb_rating: 8.4, imdb_id: 'tt1375666', season_count: null,
  created_at: '', updated_at: '',
}

function setupSupabaseMock() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'titles') {
      return {
        upsert: () => ({
          select: () => ({
            single: () => ({ data: mockUpsertedTitle, error: null }),
          }),
        }),
      }
    }
    if (table === 'platforms') {
      return {
        select: () => ({ data: mockPlatforms, error: null }),
      }
    }
    if (table === 'availability') {
      return {
        upsert: () => ({ error: null }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

beforeEach(() => {
  vi.mocked(fetchMovieDetail).mockReset()
  vi.mocked(fetchTVDetail).mockReset()
  vi.mocked(fetchShowByTMDBId).mockReset()
  mockFrom.mockReset()
})

describe('syncTitle', () => {
  it('calls fetchMovieDetail for a movie result', async () => {
    vi.mocked(fetchMovieDetail).mockResolvedValueOnce(mockMovieDetail)
    vi.mocked(fetchShowByTMDBId).mockResolvedValueOnce(mockSAShow)
    setupSupabaseMock()

    await syncTitle(movieResult)

    expect(fetchMovieDetail).toHaveBeenCalledWith(27205)
    expect(fetchTVDetail).not.toHaveBeenCalled()
  })

  it('calls fetchTVDetail for a tv result', async () => {
    const tvResult: TMDBSearchResult = {
      id: 66732, media_type: 'tv', name: 'Stranger Things',
      overview: '', poster_path: null, vote_average: 8.7, genre_ids: [18],
    }
    const tvDetail = {
      id: 66732, name: 'Stranger Things', overview: 'Kids fight monsters.',
      poster_path: null, first_air_date: '2016-07-15', vote_average: 8.7,
      number_of_seasons: 4, genres: [{ id: 18, name: 'Drama' }],
      external_ids: { imdb_id: 'tt4574334' },
    }
    vi.mocked(fetchTVDetail).mockResolvedValueOnce(tvDetail)
    vi.mocked(fetchShowByTMDBId).mockResolvedValueOnce({ ...mockSAShow, showType: 'series' })
    setupSupabaseMock()

    await syncTitle(tvResult)

    expect(fetchTVDetail).toHaveBeenCalledWith(66732)
    expect(fetchMovieDetail).not.toHaveBeenCalled()
  })

  it('returns the upserted title with availability by region', async () => {
    vi.mocked(fetchMovieDetail).mockResolvedValueOnce(mockMovieDetail)
    vi.mocked(fetchShowByTMDBId).mockResolvedValueOnce(mockSAShow)
    setupSupabaseMock()

    const result = await syncTitle(movieResult)

    expect(result.title.title).toBe('Inception')
    expect(result.title.type).toBe('movie')
    expect(result.availabilityByRegion['US']).toContain('netflix')
  })

  it('skips rent/buy streaming options — only upserts subscription and free', async () => {
    const showWithRent: SAShow = {
      ...mockSAShow,
      streamingOptions: {
        us: [
          { service: { id: 'netflix', name: 'Netflix', homePage: '', imageSet: { lightThemeImage: '', darkThemeImage: '' } }, type: 'subscription', link: '', expiresSoon: false },
          { service: { id: 'amazon', name: 'Amazon', homePage: '', imageSet: { lightThemeImage: '', darkThemeImage: '' } }, type: 'rent', link: '', expiresSoon: false },
        ],
        ph: [], gb: [], au: [], ca: [],
      },
    }
    vi.mocked(fetchMovieDetail).mockResolvedValueOnce(mockMovieDetail)
    vi.mocked(fetchShowByTMDBId).mockResolvedValueOnce(showWithRent)
    setupSupabaseMock()

    const result = await syncTitle(movieResult)

    expect(result.availabilityByRegion['US']).toContain('netflix')
    expect(result.availabilityByRegion['US']).not.toContain('amazon')
  })
})
