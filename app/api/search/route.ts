import { NextRequest, NextResponse, after } from 'next/server'
import { searchTMDB } from '@/lib/tmdb/client'
import { syncTitle } from '@/lib/sync'
import { hasRemainingQuota } from '@/lib/quota'
import { searchLocalTitles } from '@/lib/search-db'
import type { SyncedResult } from '@/types/search'

const MAX_RESULTS = 5
const SYNC_TIMEOUT_MS = 3000
const TIMED_OUT = Symbol('timed-out')

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (query.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }
  if (query.length > 200) {
    return NextResponse.json({ error: 'Query too long' }, { status: 400 })
  }

  try {
    // 1. DB-first — zero MOTN calls when we already have the title.
    const local = await searchLocalTitles(query, MAX_RESULTS)
    if (local.length > 0) {
      return NextResponse.json({ results: local, query, source: 'db' })
    }

    // 2. Not in DB — check TMDB (free, unlimited).
    const tmdbResults = await searchTMDB(query)
    if (tmdbResults.length === 0) {
      return NextResponse.json({ results: [], query, source: 'tmdb' })
    }

    // 3. Quota gate before any MOTN spend.
    if (!(await hasRemainingQuota('motn'))) {
      return NextResponse.json({
        results: [],
        query,
        source: 'tmdb',
        notice: 'Streaming availability for this title will be available soon.',
      })
    }

    // 4. Seed on-demand. If it runs long, let the same in-flight work finish
    //    in the background (no duplicate MOTN calls) and ask the user to retry.
    const top = tmdbResults.slice(0, MAX_RESULTS)
    const syncing = Promise.all(top.map((r) => syncTitle(r).catch(() => null)))
    const winner = await Promise.race([
      syncing,
      new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), SYNC_TIMEOUT_MS)),
    ])

    if (winner === TIMED_OUT) {
      after(() => syncing)
      return NextResponse.json({
        results: [],
        query,
        source: 'tmdb',
        notice: 'Finding streaming availability for this title — refresh in a moment.',
      })
    }

    const results = winner.filter((r): r is SyncedResult => r !== null)
    return NextResponse.json({ results, query, source: 'on-demand' })
  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json({
      results: [],
      query,
      notice: "We're having trouble finding that title right now. Try again in a moment.",
    })
  }
}
