import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  writeAvailabilityCore,
  confirmAvailabilityCore,
} from '@/lib/admin/availability-service'
import type { FlagServiceDeps } from '@/lib/admin/flags-service'

interface Call {
  table?: string
  op: string
  args: unknown
}

function makeStub(platformSlug: string | null = 'netflix') {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                single: async () =>
                  platformSlug
                    ? { data: { slug: platformSlug }, error: null }
                    : { data: null, error: { message: 'not found' } },
              }
            },
          }
        },
        upsert(values: unknown, options: unknown) {
          calls.push({ table, op: 'upsert', args: { values, options } })
          return { then: (r: (v: { error: null }) => void) => r({ error: null }) }
        },
        update(values: unknown) {
          return {
            eq(col: string, val: unknown) {
              calls.push({ table, op: 'update', args: { values, col, val } })
              return {
                select() {
                  return {
                    single: async () => ({ data: { title_id: 'title-9' }, error: null }),
                  }
                },
                then: (r: (v: { error: null }) => void) => r({ error: null }),
              }
            },
          }
        },
      }
    },
    rpc(fn: string, args: unknown) {
      calls.push({ op: 'rpc', args: { fn, args } })
      return { then: (r: (v: { error: null }) => void) => r({ error: null }) }
    },
  }
  return { client, calls }
}

const dropTitleCache = vi.fn()
const makeDeps = (s: ReturnType<typeof makeStub>): FlagServiceDeps => ({
  supabase: s.client as never,
  dropTitleCache,
})
const find = (calls: Call[], op: string, table?: string) =>
  calls.find((c) => c.op === op && (table === undefined || c.table === table))

beforeEach(() => dropTitleCache.mockClear())

describe('writeAvailabilityCore', () => {
  const input = {
    titleId: 'title-1',
    platformId: 'plat-1',
    regionCode: 'PH',
    available: true,
    watchUrl: 'https://viu.com/x?track=1',
    actor: { id: 'u-r', role: 'reviewer' as const },
  }

  it('reviewer write: high confidence, reviewer source, provenance, sanitized URL', async () => {
    const stub = makeStub('viu')
    const res = await writeAvailabilityCore(makeDeps(stub), input)
    expect(res.ok).toBe(true)
    const values = (find(stub.calls, 'upsert', 'availability')!.args as {
      values: Record<string, unknown>
    }).values
    expect(values.source).toBe('reviewer')
    expect(values.confidence).toBe('high')
    expect(values.reviewed_by).toBe('u-r')
    expect(values.watch_url).toBe('https://viu.com/x')
  })

  it('contributor write: medium confidence, no provenance', async () => {
    const stub = makeStub('viu')
    await writeAvailabilityCore(makeDeps(stub), {
      ...input,
      actor: { id: 'u-c', role: 'contributor' },
    })
    const values = (find(stub.calls, 'upsert', 'availability')!.args as {
      values: Record<string, unknown>
    }).values
    expect(values.source).toBe('contributor')
    expect(values.confidence).toBe('medium')
    expect(values.reviewed_by).toBeNull()
  })

  it('increments contribution and drops title cache', async () => {
    const stub = makeStub('viu')
    await writeAvailabilityCore(makeDeps(stub), input)
    expect(find(stub.calls, 'rpc')).toBeDefined()
    expect(dropTitleCache).toHaveBeenCalledWith('title-1')
  })

  it('soft-remove: available=false still writes normally', async () => {
    const stub = makeStub('viu')
    await writeAvailabilityCore(makeDeps(stub), { ...input, available: false, watchUrl: null })
    const values = (find(stub.calls, 'upsert', 'availability')!.args as {
      values: Record<string, unknown>
    }).values
    expect(values.available).toBe(false)
    expect(values.watch_url).toBeNull()
  })

  it('rejects invalid watch URL', async () => {
    const stub = makeStub('viu')
    const res = await writeAvailabilityCore(makeDeps(stub), { ...input, watchUrl: 'not a url' })
    expect(res.ok).toBe(false)
    expect(find(stub.calls, 'upsert')).toBeUndefined()
  })
})

describe('confirmAvailabilityCore', () => {
  it('sets high confidence + provenance, increments contribution, drops cache', async () => {
    const stub = makeStub()
    const res = await confirmAvailabilityCore(makeDeps(stub), {
      availabilityId: 'avail-1',
      actor: { id: 'u-r', role: 'reviewer' },
    })
    expect(res.ok).toBe(true)
    const update = find(stub.calls, 'update', 'availability')
    const values = (update!.args as { values: Record<string, unknown> }).values
    expect(values.confidence).toBe('high')
    expect(values.reviewed_by).toBe('u-r')
    expect(find(stub.calls, 'rpc')).toBeDefined()
    expect(dropTitleCache).toHaveBeenCalledWith('title-9')
  })
})
