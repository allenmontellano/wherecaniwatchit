import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { clientIp, hashIp } from './ip'

const reqWith = (headers: Record<string, string>) =>
  new NextRequest('http://localhost/api/x', { headers })

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    expect(clientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    expect(clientIp(reqWith({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it('defaults to "unknown" when no ip headers are present', () => {
    expect(clientIp(reqWith({}))).toBe('unknown')
  })
})

describe('hashIp', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
  })

  it('returns a 32-char hex hash', () => {
    expect(hashIp('1.2.3.4')).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is stable for the same ip and differs across ips', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'))
  })

  it('never contains the raw ip', () => {
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4')
  })
})
