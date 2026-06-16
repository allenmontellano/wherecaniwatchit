import { describe, it, expect } from 'vitest'
import { USER_ROLES, isUserRole } from './roles'

describe('USER_ROLES', () => {
  it('is exactly contributor, reviewer, admin in order', () => {
    expect(USER_ROLES).toEqual(['contributor', 'reviewer', 'admin'])
  })
})

describe('isUserRole', () => {
  it('accepts each valid role', () => {
    expect(isUserRole('contributor')).toBe(true)
    expect(isUserRole('reviewer')).toBe(true)
    expect(isUserRole('admin')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isUserRole('superuser')).toBe(false)
    expect(isUserRole('')).toBe(false)
    expect(isUserRole(null)).toBe(false)
    expect(isUserRole(42)).toBe(false)
    expect(isUserRole(undefined)).toBe(false)
  })
})
