import { describe, it, expect } from 'vitest'
import { stripOverriddenKeys, overrideWarning } from '@/lib/admin/title-overrides'

describe('stripOverriddenKeys', () => {
  it('removes keys present in overrides so re-sync cannot clobber them', () => {
    const fresh = { synopsis: 'tmdb text', poster_url: 'tmdb.jpg', runtime: 100 }
    const overrides = { synopsis: 'hand-written' }
    expect(stripOverriddenKeys(fresh, overrides)).toEqual({
      poster_url: 'tmdb.jpg',
      runtime: 100,
    })
  })

  it('returns fresh unchanged when overrides are empty', () => {
    const fresh = { synopsis: 'a', runtime: 1 }
    expect(stripOverriddenKeys(fresh, {})).toEqual(fresh)
  })

  it('ignores override keys not present in fresh', () => {
    expect(stripOverriddenKeys({ runtime: 5 }, { synopsis: 'x' })).toEqual({ runtime: 5 })
  })

  it('strips keys overridden to null too (an override of null is still an override)', () => {
    expect(stripOverriddenKeys({ runtime: 5, synopsis: 'a' }, { runtime: null })).toEqual({
      synopsis: 'a',
    })
  })
})

describe('overrideWarning', () => {
  it('local titles (no tmdb id) get no warning', () => {
    expect(overrideWarning('Returning Series', false)).toBe('none')
    expect(overrideWarning(null, false)).toBe('none')
  })

  it('ended/released/canceled titles get the stable warning', () => {
    expect(overrideWarning('Ended', true)).toBe('stable')
    expect(overrideWarning('Released', true)).toBe('stable')
    expect(overrideWarning('Canceled', true)).toBe('stable')
  })

  it('airing/in-production titles get the airing warning', () => {
    expect(overrideWarning('Returning Series', true)).toBe('airing')
    expect(overrideWarning('In Production', true)).toBe('airing')
    expect(overrideWarning('Planned', true)).toBe('airing')
  })

  it('unknown or null status defaults to the airing (stronger) warning', () => {
    expect(overrideWarning(null, true)).toBe('airing')
    expect(overrideWarning('Something New', true)).toBe('airing')
  })
})
