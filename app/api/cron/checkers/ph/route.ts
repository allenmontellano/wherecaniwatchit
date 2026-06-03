import { NextRequest, NextResponse } from 'next/server'
import { runCheckerBatch } from '@/lib/checkers/service'
import { PH_CONFIG } from '@/lib/checkers/config'

export const runtime = 'edge'
export const preferredRegion = ['sin1']

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  function onCircuitBreak(regionCode: string, errorRate: number) {
    console.error(
      `[checker] Circuit breaker triggered for ${regionCode}: ${(errorRate * 100).toFixed(1)}% error rate`
    )
  }

  const result = await runCheckerBatch(PH_CONFIG.regionCode, PH_CONFIG.platforms, { onCircuitBreak })
  return NextResponse.json(result)
}
