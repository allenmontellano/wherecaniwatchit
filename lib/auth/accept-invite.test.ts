import { describe, it, expect } from 'vitest'
import { parseAcceptInviteInput, resolveInviteRole } from './accept-invite'

describe('parseAcceptInviteInput', () => {
  it('accepts a valid username + password', () => {
    const r = parseAcceptInviteInput({ username: 'ann_lee', password: 'longenough', regionCode: 'PH' })
    expect(r).toEqual({ ok: true, value: { username: 'ann_lee', password: 'longenough', regionCode: 'PH' } })
  })
  it('treats blank region as null', () => {
    const r = parseAcceptInviteInput({ username: 'ann', password: 'longenough', regionCode: '' })
    expect(r).toEqual({ ok: true, value: { username: 'ann', password: 'longenough', regionCode: null } })
  })
  it('rejects a short username', () => {
    expect(parseAcceptInviteInput({ username: 'an', password: 'longenough', regionCode: '' }))
      .toEqual({ ok: false, error: 'Username must be 3–30 characters.' })
  })
  it('rejects a username with invalid characters', () => {
    expect(parseAcceptInviteInput({ username: 'ann lee!', password: 'longenough', regionCode: '' }))
      .toEqual({ ok: false, error: 'Username may only contain letters, numbers, and underscores.' })
  })
  it('rejects a short password', () => {
    expect(parseAcceptInviteInput({ username: 'ann', password: 'short', regionCode: '' }))
      .toEqual({ ok: false, error: 'Password must be at least 8 characters.' })
  })
  it('uppercases a valid 2-letter region', () => {
    const r = parseAcceptInviteInput({ username: 'ann', password: 'longenough', regionCode: 'ph' })
    expect(r).toEqual({ ok: true, value: { username: 'ann', password: 'longenough', regionCode: 'PH' } })
  })
  it('rejects a region that is not exactly two letters', () => {
    expect(parseAcceptInviteInput({ username: 'ann', password: 'longenough', regionCode: 'PHL' }))
      .toEqual({ ok: false, error: 'Region must be a 2-letter country code (e.g. PH).' })
  })
  it('rejects a region containing non-letters', () => {
    expect(parseAcceptInviteInput({ username: 'ann', password: 'longenough', regionCode: 'P1' }))
      .toEqual({ ok: false, error: 'Region must be a 2-letter country code (e.g. PH).' })
  })
})

describe('resolveInviteRole', () => {
  it('returns the role from app_metadata when valid', () => {
    expect(resolveInviteRole({ role: 'reviewer' })).toBe('reviewer')
    expect(resolveInviteRole({ role: 'admin' })).toBe('admin')
  })
  it('defaults to contributor when missing or invalid', () => {
    expect(resolveInviteRole({})).toBe('contributor')
    expect(resolveInviteRole({ role: 'wizard' })).toBe('contributor')
    expect(resolveInviteRole(null)).toBe('contributor')
    expect(resolveInviteRole(undefined)).toBe('contributor')
  })
})
