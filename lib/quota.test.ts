import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('./supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

import {
  currentMonth,
  getQuota,
  hasRemainingQuota,
  incrementQuota,
  resetQuota,
  DEFAULT_LIMIT,
} from './quota'

function mockQuotaRow(result: { data: unknown; error: unknown }) {
  mockFrom.mockImplementation((table: string) => {
    if (table !== 'api_quota') throw new Error(`Unexpected table: ${table}`)
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => result,
          }),
        }),
      }),
    }
  })
}

beforeEach(() => {
  mockFrom.mockReset()
  mockRpc.mockReset()
})

describe('currentMonth', () => {
  it('formats a date as zero-padded YYYY-MM in UTC', () => {
    expect(currentMonth(new Date('2026-06-04T12:00:00Z'))).toBe('2026-06')
    expect(currentMonth(new Date('2026-01-31T23:59:59Z'))).toBe('2026-01')
  })

  it('uses UTC, not local time, at month boundaries', () => {
    // 2026-07-01 00:30 UTC is still July in UTC regardless of local offset
    expect(currentMonth(new Date('2026-07-01T00:30:00Z'))).toBe('2026-07')
  })
})

describe('getQuota', () => {
  it('returns stored usage and limit when a row exists', async () => {
    mockQuotaRow({ data: { calls_used: 42, calls_limit: 25000 }, error: null })

    const q = await getQuota('motn')

    expect(q.callsUsed).toBe(42)
    expect(q.callsLimit).toBe(25000)
    expect(q.remaining).toBe(24958)
  })

  it('defaults to 0 used and the default limit when no row exists', async () => {
    mockQuotaRow({ data: null, error: null })

    const q = await getQuota('motn')

    expect(q.callsUsed).toBe(0)
    expect(q.callsLimit).toBe(DEFAULT_LIMIT)
    expect(q.remaining).toBe(DEFAULT_LIMIT)
  })

  it('throws when the read fails', async () => {
    mockQuotaRow({ data: null, error: { message: 'boom' } })

    await expect(getQuota('motn')).rejects.toThrow(/boom/)
  })
})

describe('hasRemainingQuota', () => {
  it('is true when usage is below limit minus buffer', async () => {
    mockQuotaRow({ data: { calls_used: 100, calls_limit: 25000 }, error: null })
    expect(await hasRemainingQuota('motn')).toBe(true)
  })

  it('is false at the buffer boundary (limit - buffer)', async () => {
    // 24500 with limit 25000 and default buffer 500: 24500 < 24500 is false
    mockQuotaRow({ data: { calls_used: 24500, calls_limit: 25000 }, error: null })
    expect(await hasRemainingQuota('motn')).toBe(false)
  })

  it('is true one call below the boundary', async () => {
    mockQuotaRow({ data: { calls_used: 24499, calls_limit: 25000 }, error: null })
    expect(await hasRemainingQuota('motn')).toBe(true)
  })

  it('respects a custom buffer', async () => {
    mockQuotaRow({ data: { calls_used: 300, calls_limit: 500 }, error: null })
    // limit - buffer = 500 - 200 = 300; 300 < 300 is false
    expect(await hasRemainingQuota('motn', 200)).toBe(false)
  })
})

describe('incrementQuota', () => {
  it('calls the increment_quota RPC and returns the new usage count', async () => {
    mockRpc.mockResolvedValueOnce({ data: 43, error: null })

    const used = await incrementQuota('motn')

    expect(used).toBe(43)
    expect(mockRpc).toHaveBeenCalledWith(
      'increment_quota',
      expect.objectContaining({ p_service: 'motn', p_n: 1 })
    )
  })

  it('passes a custom increment amount', async () => {
    mockRpc.mockResolvedValueOnce({ data: 50, error: null })

    await incrementQuota('motn', 5)

    expect(mockRpc).toHaveBeenCalledWith(
      'increment_quota',
      expect.objectContaining({ p_n: 5 })
    )
  })

  it('throws when the RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc fail' } })

    await expect(incrementQuota('motn')).rejects.toThrow(/rpc fail/)
  })
})

describe('resetQuota', () => {
  it('upserts the current month to zero usage', async () => {
    const upsert = vi.fn(() => ({ error: null }))
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'api_quota') throw new Error(`Unexpected table: ${table}`)
      return { upsert }
    })

    await resetQuota('motn')

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'motn', calls_used: 0 }),
      expect.objectContaining({ onConflict: 'service,month' })
    )
  })
})
