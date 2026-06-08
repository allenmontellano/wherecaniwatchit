import { fetchPopular } from '@/lib/tmdb/client'
import type { TMDBSearchResult } from '@/lib/tmdb/types'

export function parseLimit(argv: string[]): number | undefined {
  const arg = argv.find((a) => a.startsWith('--limit='))
  if (!arg) return undefined
  const n = Number(arg.slice('--limit='.length))
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const limit = parseLimit(process.argv)
if (limit !== undefined) process.env.SEED_MAX_TITLES = String(limit)

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

async function main() {
  const { runSeed } = await import('./seed-common')
  await runSeed(await gatherCandidates())
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main().catch((err) => {
    console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
