import { describe, it, expect } from 'vitest'
import { ISSUE_TYPES, issueToFlagType, composeNotes, sanitizeWatchUrl, sanitizePlatform } from './flags'

describe('flags helpers', () => {
  it('maps issue → flag_type', () => {
    expect(issueToFlagType('not-here')).toBe('incorrect')
    expect(issueToFlagType('is-here')).toBe('missing')
    expect(issueToFlagType('wrong-platform')).toBe('incorrect')
    expect(issueToFlagType('wrong-season')).toBe('outdated')
    expect(issueToFlagType('other')).toBe('incorrect')
  })
  it('ISSUE_TYPES has the 5 options', () =>
    expect(ISSUE_TYPES).toEqual(['not-here', 'is-here', 'wrong-platform', 'wrong-season', 'other']))
  it('composeNotes prefixes platform', () => {
    expect(composeNotes('is-here', 'Vivamax', 'hi')).toBe('Platform: Vivamax\nhi')
    expect(composeNotes('not-here', undefined, 'hi')).toBe('hi')
    expect(composeNotes('not-here', undefined, undefined)).toBeNull()
  })
})

describe('sanitizeWatchUrl', () => {
  it('returns null for empty/undefined', () => {
    expect(sanitizeWatchUrl(undefined)).toEqual({ ok: true, value: null })
    expect(sanitizeWatchUrl('   ')).toEqual({ ok: true, value: null })
  })
  it('keeps origin + pathname and drops query + fragment', () => {
    expect(sanitizeWatchUrl('https://www.netflix.com/title/81234?utm_source=share#x'))
      .toEqual({ ok: true, value: 'https://www.netflix.com/title/81234' })
  })
  it('accepts http and https', () => {
    expect(sanitizeWatchUrl('http://x.io/a')).toEqual({ ok: true, value: 'http://x.io/a' })
    expect(sanitizeWatchUrl('https://x.io')).toEqual({ ok: true, value: 'https://x.io/' })
  })
  it('rejects non-http(s) and garbage', () => {
    expect(sanitizeWatchUrl('ftp://x.io/a')).toEqual({ ok: false, error: 'Invalid watch URL.' })
    expect(sanitizeWatchUrl('not a url')).toEqual({ ok: false, error: 'Invalid watch URL.' })
    expect(sanitizeWatchUrl('javascript:alert(1)')).toEqual({ ok: false, error: 'Invalid watch URL.' })
  })
})

describe('sanitizePlatform', () => {
  const known = new Set(['netflix', 'vivamax'])
  it('returns null for empty', () => {
    expect(sanitizePlatform('', known)).toEqual({ ok: true, value: null })
    expect(sanitizePlatform(undefined, known)).toEqual({ ok: true, value: null })
  })
  it('passes a known slug through unchanged', () => {
    expect(sanitizePlatform('netflix', known)).toEqual({ ok: true, value: 'netflix' })
  })
  it('accepts a valid "Other" name', () => {
    expect(sanitizePlatform('Viu', known)).toEqual({ ok: true, value: 'Viu' })
  })
  it('treats a literal hyphen as a hyphen, not a regex range', () => {
    expect(sanitizePlatform('iWant-TFC', new Set())).toEqual({ ok: true, value: 'iWant-TFC' })
  })
  it('rejects names over 100 characters', () => {
    expect(sanitizePlatform('x'.repeat(101), known))
      .toEqual({ ok: false, error: 'Platform name must be 1–100 characters.' })
  })
  it('rejects URLs and special characters', () => {
    expect(sanitizePlatform('http://evil.com', known))
      .toEqual({ ok: false, error: 'Platform name contains invalid characters.' })
    expect(sanitizePlatform('Net<flix>', known))
      .toEqual({ ok: false, error: 'Platform name contains invalid characters.' })
  })
})
