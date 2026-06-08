import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/title-detail', () => ({ getTitleDetail: vi.fn() }))

import { GET } from './route'
import { getTitleDetail } from '@/lib/title-detail'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/titles/[id]', () => {
  it('returns 404 when the title is not found', async () => {
    vi.mocked(getTitleDetail).mockResolvedValueOnce(null)
    const res = await GET(new NextRequest('http://localhost/api/titles/missing'), {
      params: Promise.resolve({ id: 'missing' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 200 with title and availability on success', async () => {
    vi.mocked(getTitleDetail).mockResolvedValueOnce({
      // @ts-expect-error partial title is fine for this test
      title: { id: 'uuid', title: 'Inception' },
      availability: [],
    })
    const res = await GET(new NextRequest('http://localhost/api/titles/uuid'), {
      params: Promise.resolve({ id: 'uuid' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title.title).toBe('Inception')
  })

  it('returns 500 when the detail lookup throws', async () => {
    vi.mocked(getTitleDetail).mockRejectedValueOnce(new Error('boom'))
    const res = await GET(new NextRequest('http://localhost/api/titles/uuid'), {
      params: Promise.resolve({ id: 'uuid' }),
    })
    expect(res.status).toBe(500)
  })
})
