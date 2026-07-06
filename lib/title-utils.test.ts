import { describe, it, expect } from 'vitest'
import { formatRuntime, groupByRegion, formatExtent } from './title-utils'
import type { AvailabilityWithPlatform } from '@/types/database'

describe('formatExtent', () => {
  it('formats tv as N seasons', () =>
    expect(formatExtent({ type: 'tv', season_count: 7, runtime: null })).toBe('7 seasons'))
  it('singular season', () =>
    expect(formatExtent({ type: 'tv', season_count: 1, runtime: null })).toBe('1 season'))
  it('formats movie runtime', () =>
    expect(formatExtent({ type: 'movie', season_count: null, runtime: 132 })).toBe('2h 12m'))
  it('returns null when nothing to show', () =>
    expect(formatExtent({ type: 'tv', season_count: null, runtime: null })).toBeNull())
})

describe('formatRuntime', () => {
  it('formats exact hours', () => {
    expect(formatRuntime(120)).toBe('2h 0m')
  })

  it('formats hours and minutes', () => {
    expect(formatRuntime(95)).toBe('1h 35m')
  })

  it('formats minutes only when under 60', () => {
    expect(formatRuntime(45)).toBe('45m')
  })

  it('returns null for zero', () => {
    expect(formatRuntime(0)).toBeNull()
  })
})

describe('groupByRegion', () => {
  const makeEntry = (region: string, platformName: string): AvailabilityWithPlatform => ({
    id: `${region}-${platformName}`,
    title_id: 'title-1',
    platform_id: `plat-${platformName}`,
    region_code: region,
    available: true,
    last_verified: new Date().toISOString(),
    source: 'api',
    watch_url: `https://example.com/${platformName}`,
    consecutive_failures: 0,
    confidence: 'medium',
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    platform: {
      id: `plat-${platformName}`,
      name: platformName,
      slug: platformName.toLowerCase(),
      logo_url: null,
      supported_regions: [region],
      created_at: new Date().toISOString(),
    },
  })

  it('groups entries by region code', () => {
    const entries = [
      makeEntry('PH', 'Netflix'),
      makeEntry('PH', 'Apple TV+'),
      makeEntry('US', 'Netflix'),
    ]
    const grouped = groupByRegion(entries)
    expect(grouped['PH']).toHaveLength(2)
    expect(grouped['US']).toHaveLength(1)
    expect(grouped['GB']).toBeUndefined()
  })

  it('returns empty object for empty input', () => {
    expect(groupByRegion([])).toEqual({})
  })
})
