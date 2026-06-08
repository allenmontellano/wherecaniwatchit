import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mockFrom }) }))
vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  titleCacheKey: (id: string) => `title:${id}`,
  DETAIL_TTL: 21600,
}))

import { getTitleDetail } from './title-detail'
import { getCached, setCached } from '@/lib/cache'

const mockTitle = { id: 'uuid', tmdb_id: 27205, title: 'Inception', type: 'movie' }
const mockAvailability = [{ id: 'a1', region_code: 'US', available: true, platform: { name: 'Netflix' } }]

function setupDb({ title, availError = false }: { title: unknown; availError?: boolean }) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'titles') {
      return { select: () => ({ eq: () => ({ single: () => ({ data: title, error: title ? null : { message: 'not found' } }) }) }) }
    }
    if (table === 'availability') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ order: () => ({ data: availError ? null : mockAvailability, error: availError ? { message: 'boom' } : null }) }) }),
        }),
      }
    }
    return {}
  })
}

beforeEach(() => vi.clearAllMocks())

describe('getTitleDetail', () => {
  it('returns null when the title is not found', async () => {
    setupDb({ title: null })
    expect(await getTitleDetail('missing')).toBeNull()
  })

  it('returns title + availability and caches it on success', async () => {
    setupDb({ title: mockTitle })
    const result = await getTitleDetail('uuid')
    expect(result?.title.title).toBe('Inception')
    expect(result?.availability).toHaveLength(1)
    expect(setCached).toHaveBeenCalledWith('title:uuid', result, 21600)
  })

  it('returns the cached payload without querying the DB on a cache hit', async () => {
    vi.mocked(getCached).mockResolvedValueOnce({ title: { title: 'Cached' }, availability: [] })
    mockFrom.mockImplementation(() => { throw new Error('DB should not be queried on a cache hit') })
    const result = await getTitleDetail('uuid')
    expect(result?.title.title).toBe('Cached')
  })

  it('throws when the availability query fails', async () => {
    setupDb({ title: mockTitle, availError: true })
    await expect(getTitleDetail('uuid')).rejects.toThrow()
  })
})
