import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

process.env.CRON_SECRET = 'test-secret'

const mockInsert = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}))

import { POST } from './route'

beforeEach(() => {
  mockInsert.mockReset()
})

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/flags', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/flags', () => {
  it('returns 400 when availability_id is missing', async () => {
    const res = await POST(makeRequest({ flag_type: 'incorrect' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/i)
  })

  it('returns 400 when flag_type is missing', async () => {
    const res = await POST(makeRequest({ availability_id: 'uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid flag_type', async () => {
    const res = await POST(makeRequest({ availability_id: 'uuid', flag_type: 'spam' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid flag_type/i)
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

  it('returns 201 on a valid flag submission', async () => {
    mockInsert.mockResolvedValueOnce({ error: null })

    const res = await POST(makeRequest({
      availability_id: 'avail-uuid',
      flag_type: 'incorrect',
      notes: 'This is wrong',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('inserts an ip_hash rather than a raw IP', async () => {
    mockInsert.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost:3000/api/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ availability_id: 'uuid', flag_type: 'outdated' }),
    })
    await POST(req)

    const insertedRow = mockInsert.mock.calls[0][0]
    expect(insertedRow.ip_hash).toBeDefined()
    expect(insertedRow.ip_hash).not.toBe('1.2.3.4')
    expect(insertedRow.ip_hash.length).toBeGreaterThan(0)
  })

  it('truncates notes to 500 characters', async () => {
    mockInsert.mockResolvedValueOnce({ error: null })

    const longNote = 'x'.repeat(600)
    await POST(makeRequest({ availability_id: 'uuid', flag_type: 'incorrect', notes: longNote }))

    const insertedRow = mockInsert.mock.calls[0][0]
    expect(insertedRow.notes.length).toBe(500)
  })
})
