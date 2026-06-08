import { NextRequest, NextResponse } from 'next/server'
import { captureMessage } from '@/lib/observability'

// Test hook for verifying Sentry wiring. Gated behind CRON_SECRET so it
// can't be abused publicly. Returns 404 (hides existence) without the secret.
//   /api/debug/sentry?secret=…            → sends a manual message event
//   /api/debug/sentry?secret=…&mode=throw → throws an unhandled error (captured via onRequestError)
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (req.nextUrl.searchParams.get('mode') === 'throw') {
    throw new Error('Sentry test: deliberate unhandled error from /api/debug/sentry')
  }
  captureMessage('Sentry test: manual capture from /api/debug/sentry', { source: 'debug-route' }, 'info')
  return NextResponse.json({ ok: true, note: 'Sent a manual event — check the Sentry dashboard.' })
}
