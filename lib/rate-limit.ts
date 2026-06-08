import { Ratelimit } from '@upstash/ratelimit'
import { NextResponse, type NextRequest } from 'next/server'
import { getRedis } from '@/lib/redis'
import { clientIp, hashIp } from '@/lib/ip'
import { captureMessage, captureException } from '@/lib/observability'
import { appEnv } from '@/lib/env'

export type RateLimitedEndpoint = 'search' | 'titles' | 'flags'

// Requests per 60s per IP (sliding window).
const LIMITS: Record<RateLimitedEndpoint, number> = {
  search: 30,
  titles: 60,
  flags: 10,
}

export function limiterPrefix(endpoint: RateLimitedEndpoint): string {
  return `${appEnv()}:rate-limit:${endpoint}`
}

const limiters: Partial<Record<RateLimitedEndpoint, Ratelimit>> = {}

function getLimiter(endpoint: RateLimitedEndpoint): Ratelimit {
  let limiter = limiters[endpoint]
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(LIMITS[endpoint], '60 s'),
      prefix: limiterPrefix(endpoint),
    })
    limiters[endpoint] = limiter
  }
  return limiter
}

// Returns a 429 response if the caller is over the limit, otherwise null.
// Key is `<env>:rate-limit:<endpoint>:<ip-hash>` (never a raw IP). Fails open if
// Redis is unavailable so a cache outage never blocks legitimate users.
export async function enforceRateLimit(
  req: NextRequest,
  endpoint: RateLimitedEndpoint
): Promise<NextResponse | null> {
  const ipHash = hashIp(clientIp(req))

  try {
    const { success } = await getLimiter(endpoint).limit(ipHash)
    if (success) return null

    captureMessage('rate_limit_exceeded', { endpoint, ipHash }, 'warning')
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.', retryAfter: 60 },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  } catch (err) {
    captureException(err, { op: 'rate-limit', endpoint })
    return null
  }
}
