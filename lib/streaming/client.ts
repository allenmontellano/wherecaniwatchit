import type { SAShow } from './types'
import { incrementQuota } from '@/lib/quota'
import { captureException } from '@/lib/observability'

const BASE = 'https://api.movieofthenight.com/v4'

export const LAUNCH_REGIONS = ['ph', 'us', 'gb', 'au', 'ca'] as const

export async function fetchShowByTMDBId(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<SAShow | null> {
  const prefix = mediaType === 'tv' ? 'tv' : 'movie'
  const id = `${prefix}/${tmdbId}`

  const url = new URL(`${BASE}/shows/${id}`)
  url.searchParams.set('output_language', 'en')
  url.searchParams.set('series_granularity', 'show')

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-Key': process.env.MOTN_API_KEY!,
    },
    next: { revalidate: 86400 },
  } as RequestInit)

  // A response was received from MOTN, so a call was consumed — count it
  // (including 404 lookups and error responses) before branching.
  await incrementQuota('motn')

  if (res.status === 404) return null
  if (!res.ok) {
    const error = new Error(`Streaming Availability API failed: ${res.status}`)
    captureException(error, { op: 'motn.fetch', tmdbId, mediaType, status: res.status })
    throw error
  }

  return res.json()
}
