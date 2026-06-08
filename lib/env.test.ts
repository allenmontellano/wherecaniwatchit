import { afterEach, describe, expect, it, vi } from 'vitest'
import { appEnv, isStaging } from './env'

afterEach(() => vi.unstubAllEnvs())

describe('appEnv', () => {
  it('returns staging when NEXT_PUBLIC_ENV=staging', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', 'staging')
    expect(appEnv()).toBe('staging')
    expect(isStaging()).toBe(true)
  })

  it('returns production when NEXT_PUBLIC_ENV is empty', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', '')
    expect(appEnv()).toBe('production')
    expect(isStaging()).toBe(false)
  })

  it('returns production when NEXT_PUBLIC_ENV is undefined', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', undefined)
    expect(appEnv()).toBe('production')
    expect(isStaging()).toBe(false)
  })

  it('returns production for any other value', () => {
    vi.stubEnv('NEXT_PUBLIC_ENV', 'preview')
    expect(appEnv()).toBe('production')
  })
})
