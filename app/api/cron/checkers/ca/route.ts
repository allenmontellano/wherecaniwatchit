import { NextRequest, NextResponse } from 'next/server'
import { runCheckerBatch } from '@/lib/checkers/service'
import { CA_CONFIG } from '@/lib/checkers/config'

export const runtime = 'edge'
export const preferredRegion = ['yul1']

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  function onCircuitBreak(regionCode: string, errorRate: number) {
    console.error(
      `[checker] Circuit breaker triggered for ${regionCode}: ${(errorRate * 100).toFixed(1)}% error rate`
    )
    // TODO Phase 2: Sentry.captureException(new Error(`Checker circuit breaker: ${regionCode} at ${(errorRate*100).toFixed(1)}%`))
  }

  const result = await runCheckerBatch(CA_CONFIG.regionCode, CA_CONFIG.platforms, { onCircuitBreak })
  return NextResponse.json(result)
}
