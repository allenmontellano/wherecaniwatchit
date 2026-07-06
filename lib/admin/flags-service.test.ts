import { describe, it, expect, vi, beforeEach } from 'vitest'
import { acceptFlagCore, rejectFlagCore, type FlagServiceDeps } from '@/lib/admin/flags-service'

interface Call {
  table?: string
  op: string
  args: unknown
}

function makeStubSupabase(platformSlug: string | null = 'disney') {
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
              return { then: (r: (v: { error: null }) => void) => r({ error: null }) }
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

function findCall(calls: Call[], op: string, table?: string) {
  return calls.find((c) => c.op === op && (table === undefined || c.table === table))
}

const dropTitleCache = vi.fn()

function makeDeps(stub: ReturnType<typeof makeStubSupabase>): FlagServiceDeps {
  return {
    supabase: stub.client as never,
    dropTitleCache,
  }
}

const baseInput = {
  flagId: 'flag-1',
  titleId: 'title-1',
  platformId: 'plat-1',
  regionCode: 'PH',
  available: true,
  watchUrl: 'https://www.iwanttfc.com/title/x?utm_source=share',
}

beforeEach(() => {
  dropTitleCache.mockClear()
})

describe('acceptFlagCore', () => {
  it('reviewer accept upserts availability with high confidence and reviewer source', async () => {
    const stub = makeStubSupabase('netflix')
    const res = await acceptFlagCore(makeDeps(stub), {
      ...baseInput,
      actor: { id: 'user-r', role: 'reviewer' },
    })
    expect(res.ok).toBe(true)
    const upsert = findCall(stub.calls, 'upsert', 'availability')
    expect(upsert).toBeDefined()
    const values = (upsert!.args as { values: Record<string, unknown> }).values
    expect(values.source).toBe('reviewer')
    expect(values.confidence).toBe('high')
    expect(values.reviewed_by).toBe('user-r')
    expect(values.watch_url).toBe('https://www.iwanttfc.com/title/x')
    expect(values.available).toBe(true)
    const options = (upsert!.args as { options: { onConflict: string } }).options
    expect(options.onConflict).toBe('title_id,platform_id,region_code')
  })

  it('contributor accept lands medium confidence, contributor source, no reviewed_by', async () => {
    const stub = makeStubSupabase('netflix')
    await acceptFlagCore(makeDeps(stub), {
      ...baseInput,
      actor: { id: 'user-c', role: 'contributor' },
    })
    const values = (findCall(stub.calls, 'upsert', 'availability')!.args as {
      values: Record<string, unknown>
    }).values
    expect(values.source).toBe('contributor')
    expect(values.confidence).toBe('medium')
    expect(values.reviewed_by).toBeNull()
  })

  it('resolves the flag as accepted with reviewer provenance', async () => {
    const stub = makeStubSupabase('netflix')
    await acceptFlagCore(makeDeps(stub), {
      ...baseInput,
      actor: { id: 'user-r', role: 'reviewer' },
    })
    const flagUpdate = findCall(stub.calls, 'update', 'flags')
    const values = (flagUpdate!.args as { values: Record<string, unknown> }).values
    expect(values.status).toBe('resolved')
    expect(values.resolution).toBe('accepted')
    expect(values.reviewed_by).toBe('user-r')
  })

  it('increments the actor contribution count and drops the title cache', async () => {
    const stub = makeStubSupabase('netflix')
    await acceptFlagCore(makeDeps(stub), {
      ...baseInput,
      actor: { id: 'user-r', role: 'reviewer' },
    })
    const rpc = findCall(stub.calls, 'rpc')
    expect((rpc!.args as { fn: string; args: unknown }).fn).toBe('increment_contribution')
    expect((rpc!.args as { args: { p_user_id: string } }).args.p_user_id).toBe('user-r')
    expect(dropTitleCache).toHaveBeenCalledWith('title-1')
  })

  it('rejects an invalid watch URL without writing', async () => {
    const stub = makeStubSupabase('netflix')
    const res = await acceptFlagCore(makeDeps(stub), {
      ...baseInput,
      watchUrl: 'ftp://nope',
      actor: { id: 'user-r', role: 'reviewer' },
    })
    expect(res.ok).toBe(false)
    expect(findCall(stub.calls, 'upsert', 'availability')).toBeUndefined()
  })

  it('fails when the platform does not exist', async () => {
    const stub = makeStubSupabase(null)
    const res = await acceptFlagCore(makeDeps(stub), {
      ...baseInput,
      actor: { id: 'user-r', role: 'reviewer' },
    })
    expect(res.ok).toBe(false)
    expect(findCall(stub.calls, 'upsert', 'availability')).toBeUndefined()
  })

  it('applies the Disney+ PH low-confidence rule only to aggregator sources, not humans', async () => {
    const stub = makeStubSupabase('disney')
    await acceptFlagCore(makeDeps(stub), {
      ...baseInput,
      actor: { id: 'user-r', role: 'reviewer' },
    })
    const values = (findCall(stub.calls, 'upsert', 'availability')!.args as {
      values: Record<string, unknown>
    }).values
    expect(values.confidence).toBe('high')
  })
})

describe('rejectFlagCore', () => {
  it('marks the flag reviewed/rejected and increments contribution, no data write', async () => {
    const stub = makeStubSupabase()
    const res = await rejectFlagCore(makeDeps(stub), {
      flagId: 'flag-1',
      actor: { id: 'user-c', role: 'contributor' },
    })
    expect(res.ok).toBe(true)
    const flagUpdate = findCall(stub.calls, 'update', 'flags')
    const values = (flagUpdate!.args as { values: Record<string, unknown> }).values
    expect(values.status).toBe('reviewed')
    expect(values.resolution).toBe('rejected')
    expect(findCall(stub.calls, 'upsert', 'availability')).toBeUndefined()
    expect(findCall(stub.calls, 'rpc')).toBeDefined()
    expect(dropTitleCache).not.toHaveBeenCalled()
  })
})
