import { NextRequest, NextResponse } from 'next/server'
import { performSearch, isSearchCacheable, MIN_QUERY, MAX_QUERY } from '@/lib/search'
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

  const start = performance.now()
  const result = await performSearch(query)
  const durMs = Math.round((performance.now() - start) * 1000) / 1000

  const cacheable = isSearchCacheable(result)

  const res = NextResponse.json(result)
  res.headers.set(
    'Cache-Control',
    cacheable
      ? `public, s-maxage=${SEARCH_TTL}, stale-while-revalidate=${SEARCH_TTL}`
      : 'no-store',
  )
  res.headers.set('Server-Timing', `search;dur=${durMs}`)
  res.headers.set('X-Search-Compute-Ms', String(durMs))
  return res
}
