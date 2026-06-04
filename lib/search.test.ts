import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Title } from '@/types/database'
import type { SyncedResult } from '@/types/search'

vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/search-db', () => ({ searchLocalTitles: vi.fn() }))
vi.mock('@/lib/tmdb/client', () => ({ searchTMDB: vi.fn() }))
vi.mock('@/lib/sync', () => ({ syncTitle: vi.fn() }))
vi.mock('@/lib/quota', () => ({ hasRemainingQuota: vi.fn() }))

import { performSearch } from './search'
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
const synced = (t: Title): SyncedResult => ({ title: t, availabilityByRegion: { US: ['netflix'] } })
const tmdbHit = { id: 1, media_type: 'movie' as const, title: 'Inception', overview: '', poster_path: null, vote_average: 8, genre_ids: [] }

beforeEach(() => vi.clearAllMocks())

describe('performSearch', () => {
  it('returns empty for a query shorter than 2 chars without hitting TMDB', async () => {
    const res = await performSearch('a')
    expect(res.results).toEqual([])
    expect(searchLocalTitles).not.toHaveBeenCalled()
    expect(searchTMDB).not.toHaveBeenCalled()
  })

  it('returns DB results without TMDB/MOTN when found locally', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([synced(makeTitle())])
    const res = await performSearch('inception')
    expect(res.results).toHaveLength(1)
    expect(res.source).toBe('db')
    expect(searchTMDB).not.toHaveBeenCalled()
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('returns empty when neither DB nor TMDB have the title', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([])
    const res = await performSearch('zzznope')
    expect(res.results).toEqual([])
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('does not call MOTN when quota is exhausted, returns a notice', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([tmdbHit])
    vi.mocked(hasRemainingQuota).mockResolvedValueOnce(false)
    const res = await performSearch('inception')
    expect(res.results).toEqual([])
    expect(res.notice).toMatch(/soon/i)
    expect(syncTitle).not.toHaveBeenCalled()
  })

  it('seeds on-demand via syncTitle when quota is available', async () => {
    vi.mocked(searchLocalTitles).mockResolvedValueOnce([])
    vi.mocked(searchTMDB).mockResolvedValueOnce([tmdbHit])
    vi.mocked(hasRemainingQuota).mockResolvedValueOnce(true)
    vi.mocked(syncTitle).mockResolvedValueOnce(synced(makeTitle()))
    const res = await performSearch('inception')
    expect(res.results).toHaveLength(1)
    expect(res.source).toBe('on-demand')
    expect(syncTitle).toHaveBeenCalledTimes(1)
  })

  it('returns a friendly notice (never throws) when the local lookup fails', async () => {
    vi.mocked(searchLocalTitles).mockRejectedValueOnce(new Error('db down'))
    const res = await performSearch('inception')
    expect(res.results).toEqual([])
    expect(res.notice).toMatch(/trouble/i)
  })
})
