import type {
  TMDBSearchResult,
  TMDBMovieDetailFull,
  TMDBTVDetailFull,
} from './types'

const BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

function tmdbUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', process.env.TMDB_API_KEY!)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

export function posterUrl(path: string | null): string | null {
  return path ? `${IMAGE_BASE}${path}` : null
}

export async function searchTMDB(query: string): Promise<TMDBSearchResult[]> {
  const url = tmdbUrl('/search/multi', {
    query,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  })
  const res = await fetch(url, { next: { revalidate: 300 } } as RequestInit)
  if (!res.ok) throw new Error(`TMDB search failed with status ${res.status}`)
  const data = await res.json()
  return (data.results as TMDBSearchResult[]).filter(
    (r) => r.media_type === 'movie' || r.media_type === 'tv'
  )
}

export async function fetchPopular(
  mediaType: 'movie' | 'tv',
  page: number
): Promise<TMDBSearchResult[]> {
  const url = tmdbUrl(`/${mediaType}/popular`, { language: 'en-US', page: String(page) })
  const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit)
  if (!res.ok) throw new Error(`TMDB popular ${mediaType} failed: ${res.status}`)
  const data = await res.json()
  return (data.results as TMDBSearchResult[]).map((r) => ({ ...r, media_type: mediaType }))
}

export async function fetchDiscover(
  mediaType: 'movie' | 'tv',
  page: number,
  filters: Record<string, string>
): Promise<TMDBSearchResult[]> {
  const url = tmdbUrl(`/discover/${mediaType}`, {
    language: 'en-US',
    page: String(page),
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...filters,
  })
  const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit)
  if (!res.ok) throw new Error(`TMDB discover ${mediaType} failed: ${res.status}`)
  const data = await res.json()
  return (data.results as TMDBSearchResult[]).map((r) => ({ ...r, media_type: mediaType }))
}

export async function fetchMovieDetail(tmdbId: number): Promise<TMDBMovieDetailFull> {
  const url = tmdbUrl(`/movie/${tmdbId}`, {
    language: 'en-US',
    append_to_response: 'credits,release_dates',
  })
  const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit)
  if (!res.ok) throw new Error(`TMDB movie detail failed: ${res.status}`)
  return res.json()
}

export async function fetchTVDetail(tmdbId: number): Promise<TMDBTVDetailFull> {
  const url = tmdbUrl(`/tv/${tmdbId}`, {
    language: 'en-US',
    append_to_response: 'external_ids,credits,content_ratings',
  })
  const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit)
  if (!res.ok) throw new Error(`TMDB TV detail failed: ${res.status}`)
  return res.json()
}
