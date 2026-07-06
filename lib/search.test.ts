import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Title } from '@/types/database'
import type { SyncedResult } from '@/types/search'

vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/search-db', () => ({ searchByFts: vi.fn(), searchByFuzzy: vi.fn() }))
vi.mock('@/lib/tmdb/client', () => ({ searchTMDB: vi.fn() }))
vi.mock('@/lib/sync', () => ({ syncTitle: vi.fn() }))
vi.mock('@/lib/quota', () => ({ hasRemainingQuota: vi.fn() }))
vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  searchCacheKey: (q: string, y?: number | null) => `search:${q}:${y ?? ''}`,
  SEARCH_TTL: 3600,
}))

import { performSearch, isSearchCacheable } from './search'
import { searchByFts, searchByFuzzy } from '@/lib/search-db'
import { searchTMDB } from '@/lib/tmdb/client'
import { syncTitle } from '@/lib/sync'
import { hasRemainingQuota } from '@/lib/quota'
import { getCached, setCached } from '@/lib/cache'

function makeTitle(over: Partial<Title> = {}): Title {
  return {
    id: 'uuid', tmdb_id: 1, title: 'Inception', type: 'movie', genres: [], runtime: null,
    release_year: null, synopsis: null, poster_url: null, imdb_rating: null, imdb_id: null,
    season_count: null, network: null, cast: null, creators: null, origin_country: null,
    episode_count: null, status: null, original_language: null, content_rating: null,
    metadata_overrides: {}, created_at: '', updated_at: '', ...over,
  }
}
const synced = (t: Title): SyncedResult => ({ title: t, availabilityByRegion: { US: ['netflix'] } })
const tmdbHit = { id: 1, media_type: 'movie' as const, title: 'Inception', overview: '', poster_path: null, vote_average: 8, genre_ids: [] }

beforeEach(() => vi.clearAllMocks())

describe('isSearchCacheable', () => {
  it('is true for non-empty results with no notice and non-error source', () => {
    expect(isSearchCacheable({ results: [{}] as never, query: 'x', source: 'db' })).toBe(true)
  })
  it('is false for empty results', () => {
    expect(isSearchCacheable({ results: [], query: 'x', source: 'db' })).toBe(false)
  })
  it('is false when a notice is present', () => {
    expect(isSearchCacheable({ results: [{}] as never, query: 'x', source: 'tmdb', notice: 'soon' })).toBe(false)
  })
  it('is false for error source', () => {
    expect(isSearchCacheable({ results: [{}] as never, query: 'x', source: 'error' })).toBe(false)
  })
})

describe('performSearch', () => {
  it('returns empty for a query shorter than 2 chars without hitting TMDB', async () => {
    const res = await performSearch('a')
    expect(res.results).toEqual([])
    expect(searchByFts).not.toHaveBeenCalled()
    expect(searchTMDB).not.toHaveBeenCalled()
  })

  it('returns DB results without TMDB/MOTN when found locally', async () => {
    vi.mocked(searchByFts).mockResolvedValueOnce([synced(makeTitle())])
    const res = await performSearch('inception')
    expect(res.results).toHaveLength(1)
    expect(res.source).toBe('db')
    expect(searchTMDB).not.toHaveBeenCalled()
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('returns empty when neither DB nor TMDB have the title', async () => {
    vi.mocked(searchByFts).mockResolvedValueOnce([])
    vi.mocked(searchByFuzzy).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([])
    const res = await performSearch('zzznope')
    expect(res.results).toEqual([])
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('does not call MOTN when quota is exhausted, returns a notice', async () => {
    vi.mocked(searchByFts).mockResolvedValueOnce([])
    vi.mocked(searchByFuzzy).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([tmdbHit])
    vi.mocked(hasRemainingQuota).mockResolvedValueOnce(false)
    const res = await performSearch('inception')
    expect(res.results).toEqual([])
    expect(res.notice).toMatch(/soon/i)
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('seeds on-demand via syncTitle when quota is available', async () => {
    vi.mocked(searchByFts).mockResolvedValueOnce([])
    vi.mocked(searchByFuzzy).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([tmdbHit])
    vi.mocked(hasRemainingQuota).mockResolvedValueOnce(true)
    vi.mocked(syncTitle).mockResolvedValueOnce(synced(makeTitle()))
    const res = await performSearch('inception')
    expect(res.results).toHaveLength(1)
    expect(res.source).toBe('on-demand')
    expect(syncTitle).toHaveBeenCalledTimes(1)
  })

  it('returns a friendly notice (never throws) when the local lookup fails', async () => {
    vi.mocked(searchByFts).mockRejectedValueOnce(new Error('db down'))
    const res = await performSearch('inception')
    expect(res.results).toEqual([])
    expect(res.notice).toMatch(/trouble/i)
  })

  it('returns the cached response without hitting DB/TMDB on a cache hit', async () => {
    vi.mocked(getCached).mockResolvedValueOnce({
      results: [synced(makeTitle())],
      query: 'inception',
      source: 'db',
    })
    const res = await performSearch('inception')
    expect(res.results).toHaveLength(1)
    expect(searchByFts).not.toHaveBeenCalled()
    expect(searchTMDB).not.toHaveBeenCalled()
  })

  it('caches non-empty results but never caches empty results', async () => {
    vi.mocked(searchByFts).mockResolvedValueOnce([synced(makeTitle())])
    await performSearch('inception')
    expect(setCached).toHaveBeenCalledTimes(1)

    vi.mocked(setCached).mockClear()
    vi.mocked(searchByFts).mockResolvedValueOnce([])
    vi.mocked(searchByFuzzy).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([])
    await performSearch('zzznope')
    expect(setCached).not.toHaveBeenCalled()
  })

  it('falls back to fuzzy search when FTS finds nothing', async () => {
    vi.mocked(searchByFts).mockResolvedValueOnce([])
    vi.mocked(searchByFuzzy).mockResolvedValueOnce([synced(makeTitle())])
    const res = await performSearch('incepton')
    expect(res.results).toHaveLength(1)
    expect(res.source).toBe('db')
    expect(searchTMDB).not.toHaveBeenCalled()
  })
})
