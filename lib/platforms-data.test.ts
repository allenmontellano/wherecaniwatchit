import { describe, it, expect } from 'vitest'
import { buildRegionPlatformsMap } from './platforms-data'

describe('buildRegionPlatformsMap', () => {
  it('groups platforms by region, sorted by name', () => {
    const rows = [
      { slug: 'vivamax', name: 'Vivamax', supported_regions: ['PH'] },
      { slug: 'netflix', name: 'Netflix', supported_regions: ['PH', 'US'] },
      { slug: 'apple', name: 'Apple TV+', supported_regions: ['US'] },
    ]
    expect(buildRegionPlatformsMap(rows)).toEqual({
      PH: [
        { slug: 'netflix', name: 'Netflix' },
        { slug: 'vivamax', name: 'Vivamax' },
      ],
      US: [
        { slug: 'apple', name: 'Apple TV+' },
        { slug: 'netflix', name: 'Netflix' },
      ],
    })
  })
  it('returns an empty object for no rows', () => {
    expect(buildRegionPlatformsMap([])).toEqual({})
  })
})
