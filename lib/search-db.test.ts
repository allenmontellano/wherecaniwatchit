import { describe, it, expect } from 'vitest'
import { groupAvailabilityByRegion } from './search-db'

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
