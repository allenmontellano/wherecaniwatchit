import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockDel = vi.fn()

vi.mock('./redis', () => ({
  getRedis: () => ({ get: mockGet, set: mockSet, del: mockDel }),
}))

import {
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

afterEach(() => vi.unstubAllEnvs())

describe('cache keys', () => {
  it('slugifies and namespaces a search key', () => {
    expect(searchCacheKey('Parks and Recreation')).toBe('production:search:parks-and-recreation')
  })

  it('appends the year when present', () => {
    expect(searchCacheKey('Parasite', 2019)).toBe('production:search:parasite-2019')
  })

  it('prefixes title keys with the environment', () => {
    expect(titleCacheKey('abc-123')).toBe('production:title:abc-123')
  })

  it('isolates staging keys from production', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', 'staging')
    expect(searchCacheKey('severance')).toBe('staging:search:severance')
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
