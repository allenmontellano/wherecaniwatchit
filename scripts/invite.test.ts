import { describe, it, expect } from 'vitest'
import { parseInviteArgs, inviteRedirectUrl } from './invite'

describe('parseInviteArgs', () => {
  it('accepts a valid email + role', () => {
    expect(parseInviteArgs(['reviewer@example.com', 'reviewer']))
      .toEqual({ ok: true, email: 'reviewer@example.com', role: 'reviewer' })
  })
  it('rejects a missing email', () => {
    expect(parseInviteArgs([])).toEqual({ ok: false, error: 'Usage: invite <email> <role>' })
  })
  it('rejects a missing role', () => {
    expect(parseInviteArgs(['a@b.co'])).toEqual({ ok: false, error: 'Usage: invite <email> <role>' })
  })
  it('rejects an email without @', () => {
    expect(parseInviteArgs(['notanemail', 'admin'])).toEqual({ ok: false, error: 'Invalid email address.' })
  })
  it('rejects an invalid role', () => {
    expect(parseInviteArgs(['a@b.co', 'wizard']))
      .toEqual({ ok: false, error: 'Role must be one of: contributor, reviewer, admin.' })
  })
})

describe('inviteRedirectUrl', () => {
  it('appends /accept-invite to the base', () => {
    expect(inviteRedirectUrl('https://staging.wherecaniwatchit.info')).toBe(
      'https://staging.wherecaniwatchit.info/accept-invite'
    )
  })
  it('strips a trailing slash from the base', () => {
    expect(inviteRedirectUrl('https://x.io/')).toBe('https://x.io/accept-invite')
  })
})
