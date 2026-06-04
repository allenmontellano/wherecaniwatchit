import { fetchPopular } from '@/lib/tmdb/client'
import { runSeed } from './seed-common'
import type { TMDBSearchResult } from '@/lib/tmdb/types'

// TMDB returns 20 results per page → 100 pages = 2,000 titles per media type.
const PAGES = Number(process.env.SEED_PAGES) || 100

async function gatherCandidates(): Promise<TMDBSearchResult[]> {
  const all: TMDBSearchResult[] = []
  for (const media of ['movie', 'tv'] as const) {
    for (let page = 1; page <= PAGES; page++) {
      const results = await fetchPopular(media, page)
      if (results.length === 0) break
      all.push(...results)
    }
  }
  return all
}

gatherCandidates()
  .then(runSeed)
  .catch((err) => {
    console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
