import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

process.env.CRON_SECRET = 'test-secret'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }))

const mockInsert = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
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
    const body = await res.json()
    expect(body.error).toMatch(/required/i)
  })

  it('returns 400 for an invalid issue_type', async () => {
    const res = await POST(makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'spam' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid issue_type/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('inserts a mapped flag and returns 201', async () => {
    const res = await POST(
      makeRequest({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        platform: 'Vivamax',
        notes: 'hi',
      })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title_id: 't',
        region_code: 'PH',
        issue_type: 'is-here',
        flag_type: 'missing',
        availability_id: null,
        notes: 'Platform: Vivamax\nhi',
        status: 'pending',
      })
    )
  })

  it('inserts an ip_hash rather than a raw IP', async () => {
    await POST(
      makeRequest(
        { title_id: 't', region_code: 'PH', issue_type: 'wrong-season' },
        { 'x-forwarded-for': '1.2.3.4' }
      )
    )
    const insertedRow = mockInsert.mock.calls[0][0]
    expect(insertedRow.ip_hash).toBeDefined()
    expect(insertedRow.ip_hash).not.toBe('1.2.3.4')
    expect(insertedRow.flag_type).toBe('outdated')
  })

  it('truncates composed notes to 500 characters', async () => {
    const longNote = 'x'.repeat(600)
    await POST(makeRequest({ title_id: 't', region_code: 'PH', issue_type: 'other', notes: longNote }))
    const insertedRow = mockInsert.mock.calls[0][0]
    expect(insertedRow.notes.length).toBe(500)
  })
})
