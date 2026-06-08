import { NextRequest, NextResponse } from 'next/server'
import { performSearch, MIN_QUERY, MAX_QUERY } from '@/lib/search'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'search')
  if (limited) return limited

  const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (query.length < MIN_QUERY) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }
  if (query.length > MAX_QUERY) {
    return NextResponse.json({ error: 'Query too long' }, { status: 400 })
  }

  const result = await performSearch(query)
  return NextResponse.json(result)
}
