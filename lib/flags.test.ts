import { describe, it, expect } from 'vitest'
import { ISSUE_TYPES, issueToFlagType, composeNotes } from './flags'

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
