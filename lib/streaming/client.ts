import type { SAShow } from './types'

const BASE = 'https://streaming-availability.p.rapidapi.com'

export const LAUNCH_REGIONS = ['ph', 'us', 'gb', 'au', 'ca'] as const

export async function fetchShowByTMDBId(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<SAShow | null> {
  const prefix = mediaType === 'tv' ? 'tmdb:tv' : 'tmdb:movie'
  const id = `${prefix}:${tmdbId}`

  const url = new URL(`${BASE}/shows/${encodeURIComponent(id)}`)
  url.searchParams.set('output_language', 'en')
  url.searchParams.set('series_granularity', 'show')

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
      'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
    },
    next: { revalidate: 86400 },
  } as RequestInit)

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Streaming Availability API failed: ${res.status}`)

  return res.json()
}
