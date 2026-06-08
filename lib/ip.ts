import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

// Best-effort client IP from proxy headers (Next 16 has no req.ip).
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// One-way hash so raw IPs are never stored or used as cache/rate-limit keys.
export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + process.env.CRON_SECRET)
    .digest('hex')
    .slice(0, 32)
}
