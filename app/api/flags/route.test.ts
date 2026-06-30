import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

process.env.CRON_SECRET = 'test-secret'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/platforms-data', () => ({
  getRegionPlatformSlugs: vi.fn().mockResolvedValue(new Set(['vivamax', 'netflix'])),
}))

const mockInsert = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert: mockInsert }) }),
}))

import { POST } from './route'

beforeEach(() => {
  mockInsert.mockReset()
  mockInsert.mockResolvedValue({ error: null })
})

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/flags', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/flags', () => {
  it('returns 400 when title_id/region_code/issue_type are missing', async () => {
    const res = await POST(makeRequest({ issue_type: 'not-here' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/required/i)
  })

  it('returns 400 for an invalid issue_type', async () => {
    const res = await POST(makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'spam' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid issue_type/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    expect((await POST(req)).status).toBe(400)
  })

  it('stores structured fields (known slug, sanitized url, details) and returns 201', async () => {
    const res = await POST(
      makeRequest({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        reported_platform: 'vivamax',
        reported_watch_url: 'https://www.vivamax.net/watch/9?utm=x#y',
        notes: 'saw it here',
      })
    )
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        flag_type: 'missing',
        availability_id: null,
        reported_platform: 'vivamax',
        reported_watch_url: 'https://www.vivamax.net/watch/9',
        notes: 'saw it here',
        status: 'pending',
      })
    )
  })

  it('returns 400 for an invalid watch URL', async () => {
    const res = await POST(
      makeRequest({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        reported_platform: 'vivamax',
        reported_watch_url: 'not-a-url',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/watch url/i)
  })

  it('returns 400 for an invalid platform name', async () => {
    const res = await POST(
      makeRequest({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'wrong-platform',
        reported_platform: 'http://evil.com',
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/platform/i)
  })

  it('requires a platform for is-here / wrong-platform', async () => {
    const res = await POST(
      makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'wrong-platform' })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/platform is required/i)
  })

  it('allows no platform for other issue types and hashes the IP', async () => {
    const res = await POST(
      makeRequest(
        { title_id: 't', region_code: 'PH', issue_type: 'wrong-season', notes: 'season 2 wrong' },
        { 'x-forwarded-for': '1.2.3.4' }
      )
    )
    expect(res.status).toBe(201)
    const row = mockInsert.mock.calls[0][0]
    expect(row.flag_type).toBe('outdated')
    expect(row.reported_platform).toBeNull()
    expect(row.reported_watch_url).toBeNull()
    expect(row.ip_hash).toBeDefined()
    expect(row.ip_hash).not.toBe('1.2.3.4')
  })

  it('caps details at 500 characters', async () => {
    await POST(
      makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'other', notes: 'x'.repeat(600) })
    )
    expect(mockInsert.mock.calls[0][0].notes.length).toBe(500)
  })
})
