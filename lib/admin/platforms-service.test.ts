import { describe, it, expect } from 'vitest'
import { validatePlatformInput } from '@/lib/admin/platforms-service'

describe('validatePlatformInput', () => {
  it('accepts a valid platform', () => {
    const res = validatePlatformInput({
      name: 'Netflix',
      slug: 'netflix',
      regions: ['PH', 'US'],
    })
    expect(res.ok).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(validatePlatformInput({ name: ' ', slug: 'x', regions: ['PH'] }).ok).toBe(false)
  })

  it('rejects a malformed slug (uppercase, spaces, symbols)', () => {
    expect(validatePlatformInput({ name: 'X', slug: 'Bad Slug!', regions: ['PH'] }).ok).toBe(false)
    expect(validatePlatformInput({ name: 'X', slug: 'UPPER', regions: ['PH'] }).ok).toBe(false)
  })

  it('accepts hyphenated slugs', () => {
    expect(validatePlatformInput({ name: 'X', slug: 'bbc-iplayer', regions: ['GB'] }).ok).toBe(true)
  })

  it('rejects unknown regions', () => {
    expect(validatePlatformInput({ name: 'X', slug: 'x', regions: ['XX'] }).ok).toBe(false)
  })

  it('rejects an empty region list', () => {
    expect(validatePlatformInput({ name: 'X', slug: 'x', regions: [] }).ok).toBe(false)
  })
})
