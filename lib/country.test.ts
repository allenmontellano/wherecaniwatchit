import { describe, it, expect } from 'vitest'
import { REGIONS, SUPPORTED_COUNTRIES, resolveCountry, regionByCode } from './country'

describe('REGIONS', () => {
  it('lists the 5 launch regions in order with flag + name', () => {
    expect(REGIONS.map((r) => r.code)).toEqual(['PH', 'US', 'GB', 'AU', 'CA'])
    expect(REGIONS[0]).toEqual({ code: 'PH', name: 'Philippines', flag: 'ph' })
  })
  it('REGIONS codes match SUPPORTED_COUNTRIES', () => {
    expect(REGIONS.map((r) => r.code)).toEqual([...SUPPORTED_COUNTRIES])
  })
  it('regionByCode resolves each region', () => {
    expect(regionByCode.GB.name).toBe('United Kingdom')
  })
})

describe('resolveCountry', () => {
  it('prefers a valid url param', () => expect(resolveCountry('US', 'GB')).toBe('US'))
  it('falls back to cookie then PH', () => {
    expect(resolveCountry(undefined, 'GB')).toBe('GB')
    expect(resolveCountry('xx', 'yy')).toBe('PH')
  })
})
