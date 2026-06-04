import { describe, it, expect, vi, beforeEach } from 'vitest'
import { seedTitles, type SeedDeps, type SeedOptions } from './seed'
import type { TMDBSearchResult } from './tmdb/types'

function movie(id: number): TMDBSearchResult {
  return { id, media_type: 'movie', title: `Movie ${id}`, overview: '', poster_path: null, vote_average: 7, genre_ids: [] }
}

const opts: SeedOptions = { batchSize: 2, delayMs: 0, maxTitles: 1000 }

function makeDeps(over: Partial<SeedDeps> = {}): SeedDeps {
  return {
    syncTitle: vi.fn().mockResolvedValue(undefined),
    hasRemainingQuota: vi.fn().mockResolvedValue(true),
    markPending: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    ...over,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('seedTitles', () => {
  it('seeds every candidate when quota is available', async () => {
    const deps = makeDeps()
    const res = await seedTitles([movie(1), movie(2), movie(3)], new Set(), opts, deps)

    expect(res.seeded).toBe(3)
    expect(res.skipped).toBe(0)
    expect(res.failed).toBe(0)
    expect(res.stoppedReason).toBe('completed')
    expect(deps.syncTitle).toHaveBeenCalledTimes(3)
  })

  it('skips candidates already present in the database', async () => {
    const deps = makeDeps()
    const res = await seedTitles([movie(1), movie(2), movie(3)], new Set([2]), opts, deps)

    expect(res.seeded).toBe(2)
    expect(res.skipped).toBe(1)
    expect(deps.syncTitle).toHaveBeenCalledTimes(2)
  })

  it('deduplicates repeated tmdb ids within the candidate list', async () => {
    const deps = makeDeps()
    const res = await seedTitles([movie(1), movie(1), movie(2)], new Set(), opts, deps)

    expect(res.seeded).toBe(2)
    expect(deps.syncTitle).toHaveBeenCalledTimes(2)
  })

  it('stops once maxTitles is reached', async () => {
    const deps = makeDeps()
    const res = await seedTitles([movie(1), movie(2), movie(3)], new Set(), { ...opts, maxTitles: 2 }, deps)

    expect(res.seeded).toBe(2)
    expect(res.stoppedReason).toBe('max-titles')
    expect(deps.syncTitle).toHaveBeenCalledTimes(2)
  })

  it('stops when quota is exhausted', async () => {
    const deps = makeDeps({ hasRemainingQuota: vi.fn().mockResolvedValue(false) })
    const res = await seedTitles([movie(1), movie(2)], new Set(), opts, deps)

    expect(res.seeded).toBe(0)
    expect(res.stoppedReason).toBe('quota')
    expect(deps.syncTitle).not.toHaveBeenCalled()
  })

  it('stops immediately on a 429 rate-limit error without retrying', async () => {
    const syncTitle = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Streaming Availability API failed: 429'))
    const deps = makeDeps({ syncTitle })

    const res = await seedTitles([movie(1), movie(2), movie(3), movie(4)], new Set(), opts, deps)

    expect(res.stoppedReason).toBe('rate-limit')
    expect(res.seeded).toBe(1)
    // stopped at the 429 — must not attempt the remaining titles
    expect(syncTitle).toHaveBeenCalledTimes(2)
  })

  it('marks a failed title pending and continues on a non-rate-limit error', async () => {
    const syncTitle = vi
      .fn()
      .mockRejectedValueOnce(new Error('TMDB movie detail failed: 500'))
      .mockResolvedValue(undefined)
    const deps = makeDeps({ syncTitle })

    const res = await seedTitles([movie(1), movie(2), movie(3)], new Set(), opts, deps)

    expect(res.failed).toBe(1)
    expect(res.seeded).toBe(2)
    expect(res.stoppedReason).toBe('completed')
    expect(deps.markPending).toHaveBeenCalledWith(1, 'Movie 1', 'movie')
  })

  it('sleeps between batches but not after the last', async () => {
    const deps = makeDeps()
    // 5 titles, batchSize 2 => batches [1,2][3,4][5] => 2 sleeps between 3 batches
    await seedTitles([movie(1), movie(2), movie(3), movie(4), movie(5)], new Set(), opts, deps)

    expect(deps.sleep).toHaveBeenCalledTimes(2)
  })
})
