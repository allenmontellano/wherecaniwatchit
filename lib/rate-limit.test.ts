import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLimit } = vi.hoisted(() => ({ mockLimit: vi.fn() }))
const { mockCaptureMessage, mockCaptureException } = vi.hoisted(() => ({
  mockCaptureMessage: vi.fn(),
  mockCaptureException: vi.fn(),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {}
    }
    limit = mockLimit
  },
}))
vi.mock('@/lib/redis', () => ({ getRedis: () => ({}) }))
vi.mock('@/lib/observability', () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
}))

import { enforceRateLimit, limiterPrefix, limitFor } from './rate-limit'

const req = () =>
  new NextRequest('http://localhost/api/search', { headers: { 'x-forwarded-for': '1.2.3.4' } })

afterEach(() => vi.unstubAllEnvs())

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret'
  mockLimit.mockReset()
  mockCaptureMessage.mockReset()
  mockCaptureException.mockReset()
})

describe('limiterPrefix', () => {
  it('namespaces the limiter prefix by environment', () => {
    expect(limiterPrefix('search')).toBe('production:rate-limit:search')
    vi.stubEnv('NEXT_PUBLIC_ENV', 'staging')
    expect(limiterPrefix('flags')).toBe('staging:rate-limit:flags')
  })
})

describe('limitFor', () => {
  const ENV_KEYS = ['RATE_LIMIT_SEARCH', 'RATE_LIMIT_TITLES', 'RATE_LIMIT_FLAGS'] as const
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('returns the default when the env var is unset', () => {
    expect(limitFor('search')).toBe(30)
    expect(limitFor('titles')).toBe(60)
    expect(limitFor('flags')).toBe(10)
  })

  it('returns the overridden numeric value when the env var is set', () => {
    process.env.RATE_LIMIT_SEARCH = '5000'
    expect(limitFor('search')).toBe(5000)
  })

  it('falls back to the default when the env var is non-numeric', () => {
    process.env.RATE_LIMIT_SEARCH = 'not-a-number'
    expect(limitFor('search')).toBe(30)
  })

  it('falls back to the default when the env var is zero', () => {
    process.env.RATE_LIMIT_SEARCH = '0'
    expect(limitFor('search')).toBe(30)
  })

  it('falls back to the default when the env var is negative', () => {
    process.env.RATE_LIMIT_SEARCH = '-5'
    expect(limitFor('search')).toBe(30)
  })
})

describe('enforceRateLimit', () => {
  it('returns null (allows) when under the limit', async () => {
    mockLimit.mockResolvedValueOnce({ success: true })
    expect(await enforceRateLimit(req(), 'search')).toBeNull()
  })

  it('returns a 429 with Retry-After and structured body when over the limit', async () => {
    mockLimit.mockResolvedValueOnce({ success: false })

    const res = await enforceRateLimit(req(), 'search')

    expect(res).not.toBeNull()
    expect(res!.status).toBe(429)
    expect(res!.headers.get('Retry-After')).toBe('60')
    const body = await res!.json()
    expect(body).toEqual({
      error: 'Too many requests. Please wait a moment and try again.',
      retryAfter: 60,
    })
  })

  it('logs the violation to observability when over the limit', async () => {
    mockLimit.mockResolvedValueOnce({ success: false })
    await enforceRateLimit(req(), 'flags')
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'rate_limit_exceeded',
      expect.objectContaining({ endpoint: 'flags' }),
      expect.anything()
    )
  })

  it('fails open (returns null) and logs when Redis is unavailable', async () => {
    mockLimit.mockRejectedValueOnce(new Error('redis down'))

    const res = await enforceRateLimit(req(), 'titles')

    expect(res).toBeNull()
    expect(mockCaptureException).toHaveBeenCalled()
  })

  it('hashes the IP — never passes a raw IP as the rate-limit identifier', async () => {
    mockLimit.mockResolvedValueOnce({ success: true })
    await enforceRateLimit(req(), 'search')
    const identifier = mockLimit.mock.calls[0][0] as string
    expect(identifier).not.toContain('1.2.3.4')
    expect(identifier).toMatch(/^[0-9a-f]{32}$/)
  })
})
