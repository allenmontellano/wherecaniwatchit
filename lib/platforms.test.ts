import { describe, it, expect } from 'vitest'
import { platformLabel } from './platforms'

describe('platformLabel', () => {
  it('returns Netflix label with correct badge colors', () => {
    const result = platformLabel('netflix')
    expect(result.label).toBe('Netflix')
    expect(result.bg).toBeDefined()
    expect(result.text).toBeDefined()
  })

  it('returns Prime Video label for prime slug', () => {
    expect(platformLabel('prime').label).toBe('Prime Video')
  })

  it('returns Disney+ label for disney-plus slug', () => {
    expect(platformLabel('disney-plus').label).toBe('Disney+')
  })

  it('falls back gracefully for unknown slugs by capitalizing', () => {
    const result = platformLabel('some-unknown-service')
    expect(result.label).toBe('Some Unknown Service')
    expect(result.bg).toBeDefined()
    expect(result.text).toBeDefined()
  })

  it('handles single-word unknown slug', () => {
    expect(platformLabel('hulu').label).toBe('Hulu')
  })
})
