import { after } from 'next/server'
import { searchTMDB } from '@/lib/tmdb/client'
import { syncTitle } from '@/lib/sync'
import { hasRemainingQuota } from '@/lib/quota'
import { searchLocalTitles } from '@/lib/search-db'
import type { SyncedResult } from '@/types/search'

export const MIN_QUERY = 2
export const MAX_QUERY = 200
const MAX_RESULTS = 5
const SYNC_TIMEOUT_MS = 3000
const TIMED_OUT = Symbol('timed-out')

export interface SearchResponse {
  results: SyncedResult[]
  query: string
  source: 'db' | 'tmdb' | 'on-demand' | 'error'
  notice?: string
}

// Shared search logic used by both the API route and the search page (called
// directly, server-side — no HTTP self-fetch). DB-first, then quota-gated
// on-demand seeding, with graceful fallbacks. Never throws.
export async function performSearch(rawQuery: string): Promise<SearchResponse> {
  const query = rawQuery.trim()
  if (query.length < MIN_QUERY) return { results: [], query, source: 'db' }

  try {
    // 1. DB-first — zero MOTN calls when we already have the title.
    const local = await searchLocalTitles(query, MAX_RESULTS)
    if (local.length > 0) return { results: local, query, source: 'db' }

    // 2. Not in DB — check TMDB (free, unlimited).
    const tmdbResults = await searchTMDB(query)
    if (tmdbResults.length === 0) return { results: [], query, source: 'tmdb' }

    // 3. Quota gate before any MOTN spend.
    if (!(await hasRemainingQuota('motn'))) {
      return {
        results: [],
        query,
        source: 'tmdb',
        notice: 'Streaming availability for this title will be available soon.',
      }
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
      return {
        results: [],
        query,
        source: 'tmdb',
        notice: 'Finding streaming availability for this title — refresh in a moment.',
      }
    }

    return {
      results: winner.filter((r): r is SyncedResult => r !== null),
      query,
      source: 'on-demand',
    }
  } catch (err) {
    console.error('Search error:', err)
    return {
      results: [],
      query,
      source: 'error',
      notice: "We're having trouble finding that title right now. Try again in a moment.",
    }
  }
}
