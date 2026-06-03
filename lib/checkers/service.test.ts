import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PlatformCheckerConfig, AvailabilityStrategy } from './config'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockUpdate = vi.fn()
const mockSupabaseFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockSupabaseFrom }),
}))

import { buildCheckUrl, interpretResponse, runCheckerBatch } from './service'

const storedPlatform: PlatformCheckerConfig = {
  slug: 'netflix',
  name: 'Netflix',
  urlStrategy: { type: 'stored' },
  availabilityStrategy: { type: 'status_200' },
}

const searchPlatform: PlatformCheckerConfig = {
  slug: 'bbc-iplayer',
  name: 'BBC iPlayer',
  urlStrategy: { type: 'title_search', searchBase: 'https://www.bbc.co.uk/iplayer/search' },
  availabilityStrategy: { type: 'not_404' },
}

const imdbPlatform: PlatformCheckerConfig = {
  slug: 'vivamax',
  name: 'Vivamax',
  urlStrategy: { type: 'imdb_template', template: 'https://vivamax.com/watch/{imdb_id}' },
  availabilityStrategy: { type: 'status_200' },
}

const status200Strategy: AvailabilityStrategy = { type: 'status_200' }
const not404Strategy: AvailabilityStrategy = { type: 'not_404' }

beforeEach(() => {
  mockFetch.mockReset()
  mockSupabaseFrom.mockReset()
  mockUpdate.mockReset()
})

// ─── buildCheckUrl ────────────────────────────────────────────────────────────

describe('buildCheckUrl', () => {
  it('returns the stored watch_url for the stored strategy', () => {
    expect(buildCheckUrl(storedPlatform, {
      watch_url: 'https://netflix.com/title/123',
      imdb_id: null, title: 'Inception', release_year: 2010,
    })).toBe('https://netflix.com/title/123')
  })

  it('returns null for stored strategy when watch_url is null', () => {
    expect(buildCheckUrl(storedPlatform, {
      watch_url: null, imdb_id: null, title: 'Inception', release_year: 2010,
    })).toBeNull()
  })

  it('builds a search URL for the title_search strategy', () => {
    const url = buildCheckUrl(searchPlatform, {
      watch_url: null, imdb_id: null, title: 'Inception', release_year: 2010,
    })
    expect(url).toContain('https://www.bbc.co.uk/iplayer/search')
    expect(url).toContain('Inception')
  })

  it('builds URL from imdb_id for imdb_template strategy', () => {
    expect(buildCheckUrl(imdbPlatform, {
      watch_url: null, imdb_id: 'tt1375666', title: 'Inception', release_year: 2010,
    })).toBe('https://vivamax.com/watch/tt1375666')
  })

  it('returns null for imdb_template when imdb_id is null', () => {
    expect(buildCheckUrl(imdbPlatform, {
      watch_url: null, imdb_id: null, title: 'Inception', release_year: 2010,
    })).toBeNull()
  })
})

// ─── interpretResponse ────────────────────────────────────────────────────────

describe('interpretResponse', () => {
  it('status_200: available on 200', () => {
    expect(interpretResponse(status200Strategy, 200)).toBe(true)
  })

  it('status_200: unavailable on 404', () => {
    expect(interpretResponse(status200Strategy, 404)).toBe(false)
  })

  it('status_200: unavailable on 301', () => {
    expect(interpretResponse(status200Strategy, 301)).toBe(false)
  })

  it('not_404: available on 200', () => {
    expect(interpretResponse(not404Strategy, 200)).toBe(true)
  })

  it('not_404: unavailable on 404', () => {
    expect(interpretResponse(not404Strategy, 404)).toBe(false)
  })

  it('not_404: available on 301', () => {
    expect(interpretResponse(not404Strategy, 301)).toBe(true)
  })
})

// ─── runCheckerBatch ──────────────────────────────────────────────────────────

describe('runCheckerBatch', () => {
  const makeRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'avail-uuid-1',
    available: true,
    consecutive_failures: 0,
    watch_url: 'https://netflix.com/title/123',
    platform: { slug: 'netflix' },
    title: { imdb_id: 'tt1375666', title: 'Inception', release_year: 2010 },
    ...overrides,
  })

  function setupMockDb(records: ReturnType<typeof makeRecord>[], updateImpl?: (data: unknown) => unknown) {
    const capturedUpdates: unknown[] = []
    mockSupabaseFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          lt: () => ({
            limit: () => ({ data: records, error: null }),
          }),
        }),
      }),
      update: (data: unknown) => {
        capturedUpdates.push(data)
        if (updateImpl) updateImpl(data)
        return { eq: () => ({ error: null }) }
      },
    }))
    return capturedUpdates
  }

  it('makes a HEAD request to the watch_url for a stored-strategy platform', async () => {
    setupMockDb([makeRecord()])
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await runCheckerBatch('US', [storedPlatform], { onCircuitBreak: vi.fn(), batchDelayMs: 0 })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://netflix.com/title/123',
      expect.objectContaining({ method: 'HEAD' })
    )
  })

  it('marks available=true and resets consecutive_failures on 200', async () => {
    const updates = setupMockDb([makeRecord({ consecutive_failures: 1 })])
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await runCheckerBatch('US', [storedPlatform], { onCircuitBreak: vi.fn(), batchDelayMs: 0 })

    expect(updates[0]).toMatchObject({
      available: true,
      consecutive_failures: 0,
      source: 'checker',
    })
  })

  it('increments consecutive_failures on 404 but keeps available=true when below threshold', async () => {
    const updates = setupMockDb([makeRecord({ consecutive_failures: 0 })])
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    await runCheckerBatch('US', [storedPlatform], { onCircuitBreak: vi.fn(), batchDelayMs: 0 })

    expect(updates[0]).toMatchObject({
      available: true,
      consecutive_failures: 1,
      source: 'checker',
    })
  })

  it('marks available=false after reaching 2 consecutive failures', async () => {
    const updates = setupMockDb([makeRecord({ consecutive_failures: 1 })])
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    await runCheckerBatch('US', [storedPlatform], { onCircuitBreak: vi.fn(), batchDelayMs: 0 })

    expect(updates[0]).toMatchObject({
      available: false,
      consecutive_failures: 2,
    })
  })

  it('does not update the DB on a network error (keeps existing state)', async () => {
    const updates = setupMockDb([makeRecord()])
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    await runCheckerBatch('US', [storedPlatform], { onCircuitBreak: vi.fn(), batchDelayMs: 0 })

    expect(updates).toHaveLength(0)
  })

  it('skips records with null watch_url for stored-strategy platforms (counts as error)', async () => {
    const updates = setupMockDb([makeRecord({ watch_url: null })])

    await runCheckerBatch('US', [storedPlatform], { onCircuitBreak: vi.fn(), batchDelayMs: 0 })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(updates).toHaveLength(0)
  })

  it('triggers circuit breaker when error rate exceeds 20%', async () => {
    // 5 records: 2 have null watch_url (errors), 3 succeed → error rate = 2/5 = 40% > 20%
    const records = [
      makeRecord({ id: '1', watch_url: 'https://netflix.com/1' }),
      makeRecord({ id: '2', watch_url: 'https://netflix.com/2' }),
      makeRecord({ id: '3', watch_url: 'https://netflix.com/3' }),
      makeRecord({ id: '4', watch_url: null }),
      makeRecord({ id: '5', watch_url: null }),
    ]
    setupMockDb(records)
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    const onCircuitBreak = vi.fn()
    const result = await runCheckerBatch('US', [storedPlatform], {
      onCircuitBreak,
      batchSize: 10,  // process all in one batch so we can check the rate after
      batchDelayMs: 0,
    })

    expect(onCircuitBreak).toHaveBeenCalledWith('US', expect.any(Number))
    expect(result.stopped).toBe(true)
  })

  it('is config-driven: a new PlatformCheckerConfig entry is processed without any code change', async () => {
    const newPlatform: PlatformCheckerConfig = {
      slug: 'brand-new-platform',
      name: 'Brand New Platform',
      urlStrategy: { type: 'stored' },
      availabilityStrategy: { type: 'status_200' },
    }

    const updates = setupMockDb([
      makeRecord({
        platform: { slug: 'brand-new-platform' },
        watch_url: 'https://brand-new-platform.com/title/1',
      }),
    ])
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await runCheckerBatch('US', [newPlatform], { onCircuitBreak: vi.fn(), batchDelayMs: 0 })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://brand-new-platform.com/title/1',
      expect.objectContaining({ method: 'HEAD' })
    )
    expect(updates[0]).toMatchObject({ available: true, source: 'checker' })
  })
})
