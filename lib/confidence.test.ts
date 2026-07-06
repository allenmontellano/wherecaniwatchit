import { describe, it, expect } from 'vitest'
import { computeConfidence, LOW_CONFIDENCE_RULES } from '@/lib/confidence'

describe('computeConfidence', () => {
  it('reviewer writes are always high', () => {
    expect(
      computeConfidence({ source: 'reviewer', platformSlug: 'disney', regionCode: 'PH' })
    ).toBe('high')
    expect(
      computeConfidence({ source: 'reviewer', platformSlug: 'netflix', regionCode: 'US' })
    ).toBe('high')
  })

  it('contributor writes land medium (pending approval)', () => {
    expect(
      computeConfidence({ source: 'contributor', platformSlug: 'netflix', regionCode: 'PH' })
    ).toBe('medium')
  })

  it('contributor writes stay medium even for known-bad platform/region', () => {
    expect(
      computeConfidence({ source: 'contributor', platformSlug: 'disney', regionCode: 'PH' })
    ).toBe('medium')
  })

  it('MOTN aggregator (api) Disney+ PH is low', () => {
    expect(
      computeConfidence({ source: 'api', platformSlug: 'disney', regionCode: 'PH' })
    ).toBe('low')
  })

  it('MOTN aggregator (cron) Disney+ PH is low', () => {
    expect(
      computeConfidence({ source: 'cron', platformSlug: 'disney', regionCode: 'PH' })
    ).toBe('low')
  })

  it('aggregator Disney+ outside PH is medium', () => {
    expect(
      computeConfidence({ source: 'api', platformSlug: 'disney', regionCode: 'US' })
    ).toBe('medium')
  })

  it('aggregator non-Disney PH is medium', () => {
    expect(
      computeConfidence({ source: 'api', platformSlug: 'netflix', regionCode: 'PH' })
    ).toBe('medium')
  })

  it('checker writes are medium (not subject to the aggregator rule)', () => {
    expect(
      computeConfidence({ source: 'checker', platformSlug: 'disney', regionCode: 'PH' })
    ).toBe('medium')
  })

  it('unknown sources default to medium', () => {
    expect(
      computeConfidence({ source: 'mystery', platformSlug: 'netflix', regionCode: 'US' })
    ).toBe('medium')
  })
})

describe('LOW_CONFIDENCE_RULES', () => {
  it('contains the Disney+ PH aggregator rule (SP5/SP11 hook)', () => {
    expect(LOW_CONFIDENCE_RULES).toContainEqual({
      sources: ['api', 'cron'],
      platformSlugs: ['disney'],
      regionCodes: ['PH'],
    })
  })
})
