import { describe, it, expect, vi } from 'vitest'
import { changeRoleCore, inviteUserCore } from '@/lib/admin/users-service'

function makeStub(opts: { adminCount?: number; targetRole?: string } = {}) {
  const { adminCount = 2, targetRole = 'contributor' } = opts
  const updates: Record<string, unknown>[] = []
  const authCalls: { fn: string; args: unknown[] }[] = []
  const client = {
    from(table: string) {
      return {
        select(_cols: string, options?: { count?: string; head?: boolean }) {
          if (options?.count) {
            return {
              eq: async () => ({ count: adminCount, error: null }),
            }
          }
          return {
            eq() {
              return {
                single: async () => ({ data: { role: targetRole }, error: null }),
              }
            },
          }
        },
        update(values: Record<string, unknown>) {
          return {
            eq() {
              updates.push({ table, ...values })
              return { then: (r: (v: { error: null }) => void) => r({ error: null }) }
            },
          }
        },
      }
    },
    auth: {
      admin: {
        updateUserById: vi.fn(async (...args: unknown[]) => {
          authCalls.push({ fn: 'updateUserById', args })
          return { data: {}, error: null }
        }),
        inviteUserByEmail: vi.fn(async (...args: unknown[]) => {
          authCalls.push({ fn: 'inviteUserByEmail', args })
          return { data: { user: { id: 'new-user' } }, error: null }
        }),
      },
    },
  }
  return { client, updates, authCalls }
}

const actor = { id: 'admin-1', role: 'admin' as const }

describe('changeRoleCore', () => {
  it('updates app_metadata and profiles.role', async () => {
    const stub = makeStub()
    const res = await changeRoleCore(stub.client as never, {
      userId: 'u-2',
      newRole: 'reviewer',
      actor,
    })
    expect(res.ok).toBe(true)
    expect(stub.authCalls[0].fn).toBe('updateUserById')
    expect(stub.updates[0]).toMatchObject({ table: 'profiles', role: 'reviewer' })
  })

  it('blocks demoting the last admin', async () => {
    const stub = makeStub({ adminCount: 1, targetRole: 'admin' })
    const res = await changeRoleCore(stub.client as never, {
      userId: 'u-1',
      newRole: 'reviewer',
      actor,
    })
    expect(res.ok).toBe(false)
    expect(stub.authCalls).toHaveLength(0)
    expect(stub.updates).toHaveLength(0)
  })

  it('allows demoting an admin when another admin remains', async () => {
    const stub = makeStub({ adminCount: 2, targetRole: 'admin' })
    const res = await changeRoleCore(stub.client as never, {
      userId: 'u-2',
      newRole: 'contributor',
      actor,
    })
    expect(res.ok).toBe(true)
  })

  it('rejects an invalid role', async () => {
    const stub = makeStub()
    const res = await changeRoleCore(stub.client as never, {
      userId: 'u-2',
      newRole: 'superuser' as never,
      actor,
    })
    expect(res.ok).toBe(false)
  })
})

describe('inviteUserCore', () => {
  it('invites by email and stages the role in app_metadata', async () => {
    const stub = makeStub()
    const res = await inviteUserCore(stub.client as never, {
      email: 'new@example.com',
      role: 'reviewer',
    })
    expect(res.ok).toBe(true)
    expect(stub.authCalls[0].fn).toBe('inviteUserByEmail')
    expect(stub.authCalls[1].fn).toBe('updateUserById')
  })

  it('rejects a bad email', async () => {
    const stub = makeStub()
    const res = await inviteUserCore(stub.client as never, { email: 'nope', role: 'reviewer' })
    expect(res.ok).toBe(false)
    expect(stub.authCalls).toHaveLength(0)
  })
})
