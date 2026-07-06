import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  saveTitleOverridesCore,
  resetTitleOverrideCore,
  addLocalTitleCore,
} from '@/lib/admin/titles-service'
import type { FlagServiceDeps } from '@/lib/admin/flags-service'

interface Call {
  table?: string
  op: string
  args: unknown
}

function makeStub(existingOverrides: Record<string, unknown> = {}) {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                single: async () => ({
                  data: { metadata_overrides: existingOverrides },
                  error: null,
                }),
              }
            },
          }
        },
        update(values: unknown) {
          return {
            eq(col: string, val: unknown) {
              calls.push({ table, op: 'update', args: { values, col, val } })
              return { then: (r: (v: { error: null }) => void) => r({ error: null }) }
            },
          }
        },
        insert(values: unknown) {
          calls.push({ table, op: 'insert', args: { values } })
          return {
            select() {
              return { single: async () => ({ data: { id: 'new-title' }, error: null }) }
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
const deps = (s: ReturnType<typeof makeStub>): FlagServiceDeps => ({
  supabase: s.client as never,
  dropTitleCache,
})
const find = (calls: Call[], op: string, table?: string) =>
  calls.find((c) => c.op === op && (table === undefined || c.table === table))

const actor = { id: 'admin-1', role: 'admin' as const }

beforeEach(() => dropTitleCache.mockClear())

describe('saveTitleOverridesCore', () => {
  it('applies changed fields to columns AND records them in metadata_overrides', async () => {
    const stub = makeStub({ synopsis: 'old override' })
    const res = await saveTitleOverridesCore(deps(stub), {
      titleId: 't-1',
      changes: { title: 'Fixed Name', release_year: 2020 },
      actor,
    })
    expect(res.ok).toBe(true)
    const update = find(stub.calls, 'update', 'titles')
    const values = (update!.args as { values: Record<string, unknown> }).values
    expect(values.title).toBe('Fixed Name')
    expect(values.release_year).toBe(2020)
    expect(values.metadata_overrides).toEqual({
      synopsis: 'old override',
      title: 'Fixed Name',
      release_year: 2020,
    })
    expect(find(stub.calls, 'rpc')).toBeDefined()
    expect(dropTitleCache).toHaveBeenCalledWith('t-1')
  })

  it('rejects protected keys (tmdb_id, id)', async () => {
    const stub = makeStub()
    const res = await saveTitleOverridesCore(deps(stub), {
      titleId: 't-1',
      changes: { tmdb_id: 999 } as never,
      actor,
    })
    expect(res.ok).toBe(false)
    expect(find(stub.calls, 'update')).toBeUndefined()
  })

  it('rejects empty changes', async () => {
    const stub = makeStub()
    const res = await saveTitleOverridesCore(deps(stub), { titleId: 't-1', changes: {}, actor })
    expect(res.ok).toBe(false)
  })
})

describe('resetTitleOverrideCore', () => {
  it('removes the key from metadata_overrides', async () => {
    const stub = makeStub({ synopsis: 'x', title: 'y' })
    const res = await resetTitleOverrideCore(deps(stub), { titleId: 't-1', key: 'synopsis', actor })
    expect(res.ok).toBe(true)
    const values = (find(stub.calls, 'update', 'titles')!.args as {
      values: Record<string, unknown>
    }).values
    expect(values.metadata_overrides).toEqual({ title: 'y' })
  })
})

describe('addLocalTitleCore', () => {
  it('inserts a title with tmdb_id null and increments contribution', async () => {
    const stub = makeStub()
    const res = await addLocalTitleCore(deps(stub), {
      fields: { title: 'Local PH Movie', type: 'movie', release_year: 2025 },
      actor,
    })
    expect(res.ok).toBe(true)
    const values = (find(stub.calls, 'insert', 'titles')!.args as {
      values: Record<string, unknown>
    }).values
    expect(values.tmdb_id).toBeNull()
    expect(values.title).toBe('Local PH Movie')
    expect(find(stub.calls, 'rpc')).toBeDefined()
  })

  it('requires a title name', async () => {
    const stub = makeStub()
    const res = await addLocalTitleCore(deps(stub), {
      fields: { title: '  ', type: 'movie' },
      actor,
    })
    expect(res.ok).toBe(false)
  })
})
