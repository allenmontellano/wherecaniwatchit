import { NextRequest, NextResponse } from 'next/server'
import { captureMessage } from '@/lib/observability'

// Test hook for verifying Sentry wiring. Gated behind CRON_SECRET so it
// can't be abused publicly. Returns 404 (hides existence) without the secret.
//   /api/debug/sentry?secret=…            → sends a manual message event
//   /api/debug/sentry?secret=…&mode=throw → throws an unhandled error (captured via onRequestError)
export async function GET(req: NextRequest) {
  const check = req.nextUrl.searchParams.get('check')

  // Health checks expose only booleans / ok-status (no secrets), so they are
  // ungated for diagnosis. Will be removed once prod config is confirmed.
  if (check === 'env') {
    return NextResponse.json({
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      SENTRY_DSN: !!process.env.SENTRY_DSN,
      NEXT_PUBLIC_SENTRY_DSN: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    })
  }

  if (check === 'ip') {
    const { clientIp, hashIp } = await import('@/lib/ip')
    return NextResponse.json({
      xForwardedFor: req.headers.get('x-forwarded-for'),
      xRealIp: req.headers.get('x-real-ip'),
      clientIp: clientIp(req),
      ipHash: hashIp(clientIp(req)),
    })
  }

  if (check === 'ratelimit') {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const { getRedis } = await import('@/lib/redis')
      const rl = new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(3, '60 s'),
        prefix: `debug-rl-${Date.now()}`,
      })
      const results: boolean[] = []
      for (let i = 0; i < 5; i++) {
        const r = await rl.limit('debugkey')
        results.push(r.success)
      }
      // Expect [true, true, true, false, false]
      return NextResponse.json({ results })
    } catch (err) {
      return NextResponse.json({
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 4) : undefined,
      })
    }
  }

  if (check === 'enforce') {
    const { clientIp, hashIp } = await import('@/lib/ip')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { getRedis } = await import('@/lib/redis')
    try {
      const limiter = new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        prefix: `rate-limit:search-debug-${Date.now()}`,
      })
      const id = hashIp(clientIp(req))
      const results: boolean[] = []
      for (let i = 0; i < 35; i++) {
        const r = await limiter.limit(id)
        results.push(r.success)
      }
      const blocked = results.filter((x) => !x).length
      return NextResponse.json({ id, blocked, allowed: 35 - blocked })
    } catch (err) {
      return NextResponse.json({
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
      })
    }
  }

  if (check === 'enforce-real') {
    const { enforceRateLimit } = await import('@/lib/rate-limit')
    const results: Array<string | number> = []
    for (let i = 0; i < 35; i++) {
      const r = await enforceRateLimit(req, 'search')
      results.push(r === null ? 'ok' : r.status)
    }
    return NextResponse.json({ blocked: results.filter((x) => x === 429).length, last5: results.slice(-5) })
  }

  if (check === 'redis') {
    try {
      const { getRedis } = await import('@/lib/redis')
      const redis = getRedis()
      const token = Date.now()
      await redis.set('debug:ping', token, { ex: 30 })
      const value = await redis.get('debug:ping')
      return NextResponse.json({ redis: 'ok', roundTrip: value === token })
    } catch (err) {
      return NextResponse.json({ redis: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // Error-triggering paths stay gated behind CRON_SECRET.
  if (req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (req.nextUrl.searchParams.get('mode') === 'throw') {
    throw new Error('Sentry test: deliberate unhandled error from /api/debug/sentry')
  }
  captureMessage('Sentry test: manual capture from /api/debug/sentry', { source: 'debug-route' }, 'info')
  return NextResponse.json({ ok: true, note: 'Sent a manual event — check the Sentry dashboard.' })
}
