import { NextRequest, NextResponse } from 'next/server'
import { runCheckerBatch } from '@/lib/checkers/service'
import { US_CONFIG } from '@/lib/checkers/config'

export const runtime = 'edge'
export const preferredRegion = ['iad1']

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  function onCircuitBreak(regionCode: string, errorRate: number) {
    console.error(
      `[checker] Circuit breaker triggered for ${regionCode}: ${(errorRate * 100).toFixed(1)}% error rate`
    )
  }

  const result = await runCheckerBatch(US_CONFIG.regionCode, US_CONFIG.platforms, { onCircuitBreak })
  return NextResponse.json(result)
}
