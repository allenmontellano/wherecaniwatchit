import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMovieDetail, fetchTVDetail, posterUrl } from '@/lib/tmdb/client'
import { fetchShowByTMDBId, LAUNCH_REGIONS } from '@/lib/streaming/client'
import type { TMDBSearchResult } from '@/lib/tmdb/types'
import type { Title, Platform } from '@/types/database'

const SA_TO_DB_REGION: Record<string, string> = {
  ph: 'PH', us: 'US', gb: 'GB', au: 'AU', ca: 'CA',
}

export interface SyncedTitle {
  title: Title
  availabilityByRegion: Record<string, string[]> // DB region code → platform slugs
}

export async function syncTitle(result: TMDBSearchResult): Promise<SyncedTitle> {
  const supabase = createAdminClient()

  // 1. Fetch full TMDB metadata
  type TitleInsert = Omit<Title, 'id' | 'created_at' | 'updated_at'>
  let titleData: TitleInsert

  if (result.media_type === 'movie') {
    const d = await fetchMovieDetail(result.id)
    titleData = {
      tmdb_id: d.id,
      title: d.title,
      type: 'movie',
      genres: d.genres.map((g) => g.name),
      runtime: d.runtime ?? null,
      release_year: d.release_date ? parseInt(d.release_date.slice(0, 4)) : null,
      synopsis: d.overview || null,
      poster_url: posterUrl(d.poster_path),
      imdb_rating: d.vote_average ? parseFloat(d.vote_average.toFixed(1)) : null,
      imdb_id: d.imdb_id ?? null,
      season_count: null,
    }
  } else {
    const d = await fetchTVDetail(result.id)
    titleData = {
      tmdb_id: d.id,
      title: d.name,
      type: 'tv',
      genres: d.genres.map((g) => g.name),
      runtime: null,
      release_year: d.first_air_date ? parseInt(d.first_air_date.slice(0, 4)) : null,
      synopsis: d.overview || null,
      poster_url: posterUrl(d.poster_path),
      imdb_rating: d.vote_average ? parseFloat(d.vote_average.toFixed(1)) : null,
      imdb_id: d.external_ids?.imdb_id ?? null,
      season_count: d.number_of_seasons ?? null,
    }
  }

  // 2. Upsert title
  const { data: upsertedTitle, error: titleError } = await supabase
    .from('titles')
    .upsert(titleData, { onConflict: 'tmdb_id' })
    .select()
    .single()

  if (titleError || !upsertedTitle) {
    throw new Error(`Failed to upsert title: ${titleError?.message}`)
  }

  // 3. Fetch streaming availability
  const saShow = await fetchShowByTMDBId(result.id, result.media_type)

  // 4. Load platforms to resolve IDs from slugs
  const { data: platforms, error: platError } = await supabase
    .from('platforms')
    .select('*')

  if (platError || !platforms) {
    throw new Error(`Failed to load platforms: ${platError?.message}`)
  }

  const platformBySlug = new Map<string, Platform>(
    (platforms as Platform[]).map((p) => [p.slug, p])
  )

  // 5. Upsert availability rows
  const availabilityByRegion: Record<string, string[]> = {}

  if (saShow?.streamingOptions) {
    for (const saRegion of LAUNCH_REGIONS) {
      const dbRegion = SA_TO_DB_REGION[saRegion]
      if (!dbRegion) continue

      const options = saShow.streamingOptions[saRegion] ?? []
      const slugsForRegion: string[] = []

      for (const option of options) {
        if (option.type !== 'subscription' && option.type !== 'free') continue

        const platform = platformBySlug.get(option.service.id)
        if (!platform) continue

        await supabase.from('availability').upsert(
          {
            title_id: upsertedTitle.id,
            platform_id: platform.id,
            region_code: dbRegion,
            available: true,
            last_verified: new Date().toISOString(),
            source: 'api',
            watch_url: option.link,
          },
          { onConflict: 'title_id,platform_id,region_code' }
        )

        slugsForRegion.push(option.service.id)
      }

      availabilityByRegion[dbRegion] = slugsForRegion
    }
  }

  return { title: upsertedTitle as Title, availabilityByRegion }
}
