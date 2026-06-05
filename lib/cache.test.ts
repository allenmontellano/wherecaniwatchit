import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockDel = vi.fn()

vi.mock('./redis', () => ({
  getRedis: () => ({ get: mockGet, set: mockSet, del: mockDel }),
}))

import {
  normalizeQuery,
  searchCacheKey,
  titleCacheKey,
  getCached,
  setCached,
  delCached,
  SEARCH_TTL,
} from './cache'

beforeEach(() => {
  mockGet.mockReset()
  mockSet.mockReset()
  mockDel.mockReset()
})

describe('normalizeQuery', () => {
  it('lowercases, trims, and hyphenates spaces', () => {
    expect(normalizeQuery('  Parks and Recreation  ')).toBe('parks-and-recreation')
  })

  it('strips special characters except hyphens', () => {
    expect(normalizeQuery('Spider-Man: No Way Home!')).toBe('spider-man-no-way-home')
  })

  it('collapses repeated spaces and hyphens', () => {
    expect(normalizeQuery('The   Office')).toBe('the-office')
    expect(normalizeQuery('a -- b')).toBe('a-b')
  })

  it('expands known abbreviations (whole-query only)', () => {
    expect(normalizeQuery('P&R')).toBe('parks-and-recreation')
    expect(normalizeQuery('GoT')).toBe('game-of-thrones')
    expect(normalizeQuery('HIMYM')).toBe('how-i-met-your-mother')
    expect(normalizeQuery('TBBT')).toBe('the-big-bang-theory')
    expect(normalizeQuery('AoT')).toBe('attack-on-titan')
  })

  it('does not expand an abbreviation embedded in a larger query', () => {
    expect(normalizeQuery('got milk')).toBe('got-milk')
  })
})

describe('cache keys', () => {
  it('builds a search key from the normalized query', () => {
    expect(searchCacheKey('Parks and Recreation')).toBe('search:parks-and-recreation')
  })

  it('builds a title key from the id', () => {
    expect(titleCacheKey('abc-123')).toBe('title:abc-123')
  })
})

describe('getCached', () => {
  it('returns the stored value on a hit', async () => {
    mockGet.mockResolvedValueOnce({ hello: 'world' })
    expect(await getCached('k')).toEqual({ hello: 'world' })
  })

  it('returns null on a miss', async () => {
    mockGet.mockResolvedValueOnce(null)
    expect(await getCached('k')).toBeNull()
  })

  it('fails open (returns null) when Redis throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('redis down'))
    expect(await getCached('k')).toBeNull()
  })
})

describe('setCached', () => {
  it('stores with a TTL', async () => {
    mockSet.mockResolvedValueOnce('OK')
    await setCached('k', { a: 1 }, SEARCH_TTL)
    expect(mockSet).toHaveBeenCalledWith('k', { a: 1 }, { ex: SEARCH_TTL })
  })

  it('fails open (does not throw) when Redis throws', async () => {
    mockSet.mockRejectedValueOnce(new Error('redis down'))
    await expect(setCached('k', { a: 1 }, SEARCH_TTL)).resolves.toBeUndefined()
  })
})

describe('delCached', () => {
  it('deletes the key', async () => {
    mockDel.mockResolvedValueOnce(1)
    await delCached('k')
    expect(mockDel).toHaveBeenCalledWith('k')
  })

  it('fails open when Redis throws', async () => {
    mockDel.mockRejectedValueOnce(new Error('redis down'))
    await expect(delCached('k')).resolves.toBeUndefined()
  })
})
