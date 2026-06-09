import { describe, it, expect, vi } from 'vitest'
import { groupAvailabilityByRegion, searchByFts, searchByFuzzy } from './search-db'

describe('groupAvailabilityByRegion', () => {
  it('groups platform slugs by title and region', () => {
    const grouped = groupAvailabilityByRegion([
      { title_id: 't1', region_code: 'US', platform: { slug: 'netflix' } },
      { title_id: 't1', region_code: 'US', platform: { slug: 'hulu' } },
      { title_id: 't1', region_code: 'PH', platform: { slug: 'netflix' } },
      { title_id: 't2', region_code: 'GB', platform: { slug: 'bbc' } },
    ])

    expect(grouped.get('t1')).toEqual({ US: ['netflix', 'hulu'], PH: ['netflix'] })
    expect(grouped.get('t2')).toEqual({ GB: ['bbc'] })
  })

  it('handles the joined platform arriving as an array (Supabase join shape)', () => {
    const grouped = groupAvailabilityByRegion([
      { title_id: 't1', region_code: 'US', platform: [{ slug: 'netflix' }] },
    ])

    expect(grouped.get('t1')).toEqual({ US: ['netflix'] })
  })

  it('skips rows with no platform', () => {
    const grouped = groupAvailabilityByRegion([
      { title_id: 't1', region_code: 'US', platform: null },
    ])

    expect(grouped.get('t1')).toBeUndefined()
  })
})

function mockSupabase(titleRows: unknown[], availRows: unknown[]) {
  const availChain = {
    select: () => availChain,
    in: () => availChain,
    eq: () => Promise.resolve({ data: availRows, error: null }),
  }
  return {
    rpc: vi.fn().mockResolvedValue({ data: titleRows, error: null }),
    from: vi.fn().mockReturnValue(availChain),
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
import { createAdminClient } from '@/lib/supabase/admin'

const aTitle = { id: 't1', tmdb_id: 1, title: 'The Matrix', type: 'movie' }

describe('searchByFts', () => {
  it('calls the FTS rpc with query/year/limit and assembles availability', async () => {
    const sb = mockSupabase([aTitle], [{ title_id: 't1', region_code: 'US', platform: { slug: 'netflix' } }])
    vi.mocked(createAdminClient).mockReturnValue(sb as never)
    const res = await searchByFts('the matrix', null, 5)
    expect(sb.rpc).toHaveBeenCalledWith('search_titles_fts', { q: 'the matrix', y: null, lim: 5 })
    expect(res).toHaveLength(1)
    expect(res[0].title.id).toBe('t1')
    expect(res[0].availabilityByRegion).toEqual({ US: ['netflix'] })
  })
  it('returns [] when the rpc yields no rows', async () => {
    const sb = mockSupabase([], [])
    vi.mocked(createAdminClient).mockReturnValue(sb as never)
    expect(await searchByFts('nope', null, 5)).toEqual([])
  })
})

describe('searchByFuzzy', () => {
  it('calls the fuzzy rpc with threshold 0.3', async () => {
    const sb = mockSupabase([aTitle], [])
    vi.mocked(createAdminClient).mockReturnValue(sb as never)
    await searchByFuzzy('the matric', 2003, 5)
    expect(sb.rpc).toHaveBeenCalledWith('search_titles_fuzzy', { q: 'the matric', y: 2003, lim: 5, threshold: 0.3 })
  })
})
