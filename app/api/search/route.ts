import { NextRequest, NextResponse } from 'next/server'
import { performSearch, MIN_QUERY, MAX_QUERY } from '@/lib/search'
import { enforceRateLimit } from '@/lib/rate-limit'
import { SEARCH_TTL } from '@/lib/cache'

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

  const cacheable =
    result.results.length > 0 && !result.notice && result.source !== 'error'

  const res = NextResponse.json(result)
  res.headers.set(
    'Cache-Control',
    cacheable
      ? `public, s-maxage=${SEARCH_TTL}, stale-while-revalidate=${SEARCH_TTL}`
      : 'no-store',
  )
  return res
}
