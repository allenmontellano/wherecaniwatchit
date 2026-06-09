import { describe, expect, it } from 'vitest'
import { normalizeSearch } from './query-normalizer'

const q = (s: string) => normalizeSearch(s).query

describe('normalizeSearch — abbreviations (whole-string)', () => {
  it.each([
    ['P&R', 'parks and recreation'],
    ['got', 'game of thrones'],
    ['HIMYM', 'how i met your mother'],
    ['tbbt', 'the big bang theory'],
    ['AoT', 'attack on titan'],
    ['lotr', 'the lord of the rings'],
    ['HOTD', 'house of the dragon'],
    ['twd', 'the walking dead'],
    ['bb', 'breaking bad'],
    ['bcs', 'better call saul'],
    ['f&f', 'fast and furious'],
    ['ahs', 'american horror story'],
  ])('%s -> %s', (input, expected) => {
    expect(q(input)).toBe(expected)
  })

  it('only expands whole-string matches, not substrings', () => {
    expect(q('abba')).toBe('abba')
  })
})

describe('normalizeSearch — filler stripping', () => {
  it('strips leading "where can i watch"', () => {
    expect(q('where can i watch severance')).toBe('severance')
  })
  it('strips "is ... on <platform>"', () => {
    expect(q('is parasite on netflix')).toBe('parasite')
  })
  it('strips leading "watch"', () => {
    expect(q('watch the office')).toBe('the office')
  })
  it('strips trailing "streaming"', () => {
    expect(q('severance streaming')).toBe('severance')
  })
  it('does NOT strip "on" from a legitimate title', () => {
    expect(q('on the road')).toBe('on the road')
    expect(q('watch on the road')).toBe('on the road')
    expect(q('lost on you')).toBe('lost on you')
  })
})

describe('normalizeSearch — year + season/episode suffixes', () => {
  it('extracts a trailing year as a filter', () => {
    expect(normalizeSearch('Parasite 2019')).toEqual({ query: 'parasite', year: 2019 })
  })
  it('leaves query without a year as year=null', () => {
    expect(normalizeSearch('parasite')).toEqual({ query: 'parasite', year: null })
  })
  it('strips season/episode suffixes', () => {
    expect(q('Severance season 2')).toBe('severance')
    expect(q('severance s2')).toBe('severance')
    expect(q('the bear episode 3')).toBe('the bear')
  })
})
