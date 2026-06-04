import { fetchDiscover } from '@/lib/tmdb/client'
import { runSeed } from './seed-common'
import type { TMDBSearchResult } from '@/lib/tmdb/types'

// TMDB *movie* genre IDs. (TV uses a different genre taxonomy, so genre
// expansion targets movies by genre, plus anime via TV Animation + Japan.)
const MOVIE_GENRES: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Fantasy: 14,
  Horror: 27,
  Mystery: 9648,
  Romance: 10749,
  'Science Fiction': 878,
  Thriller: 53,
  War: 10752,
}

const PAGES_PER_GENRE = 5

async function gatherCandidates(): Promise<TMDBSearchResult[]> {
  const all: TMDBSearchResult[] = []

  for (const [name, id] of Object.entries(MOVIE_GENRES)) {
    for (let page = 1; page <= PAGES_PER_GENRE; page++) {
      const results = await fetchDiscover('movie', page, { with_genres: String(id) })
      if (results.length === 0) break
      all.push(...results)
    }
    console.log(`Gathered ${name} candidates`)
  }

  // Anime: TV Animation genre (16) restricted to Japanese origin.
  for (let page = 1; page <= PAGES_PER_GENRE; page++) {
    const results = await fetchDiscover('tv', page, { with_genres: '16', with_origin_country: 'JP' })
    if (results.length === 0) break
    all.push(...results)
  }
  console.log('Gathered anime candidates')

  return all
}

gatherCandidates()
  .then(runSeed)
  .catch((err) => {
    console.error('\n❌ Genre seed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
