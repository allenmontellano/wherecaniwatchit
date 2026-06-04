import { createAdminClient } from '@/lib/supabase/admin'
import { syncTitle } from '@/lib/sync'
import { hasRemainingQuota, getQuota } from '@/lib/quota'
import { seedTitles, type SeedDeps, type SeedOptions } from '@/lib/seed'
import type { TMDBSearchResult } from '@/lib/tmdb/types'

export const SEED_OPTIONS: SeedOptions = {
  batchSize: 20,
  delayMs: 1000,
  maxTitles: Number(process.env.SEED_MAX_TITLES) || 4000,
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function getExistingTmdbIds(): Promise<Set<number>> {
  const supabase = createAdminClient()
  const ids = new Set<number>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('titles')
      .select('tmdb_id')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Failed to load existing titles: ${error.message}`)
    if (!data?.length) break
    for (const row of data) ids.add(row.tmdb_id as number)
    if (data.length < pageSize) break
    from += pageSize
  }
  return ids
}

async function markPending(tmdbId: number, title: string, type: 'movie' | 'tv'): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('titles')
    .upsert({ tmdb_id: tmdbId, title, type, seed_status: 'pending' }, { onConflict: 'tmdb_id' })
}

function makeSeedDeps(): SeedDeps {
  return {
    syncTitle,
    hasRemainingQuota: () => hasRemainingQuota('motn'),
    markPending,
    sleep,
    log: (message) => console.log(message),
  }
}

export async function runSeed(candidates: TMDBSearchResult[]): Promise<void> {
  const before = await getQuota('motn')
  console.log(`\nQuota at start: ${before.callsUsed}/${before.callsLimit} (remaining ${before.remaining})`)

  const existing = await getExistingTmdbIds()
  console.log(`Existing titles in DB: ${existing.size}; candidates fetched from TMDB: ${candidates.length}\n`)

  const start = Date.now()
  const result = await seedTitles(candidates, existing, SEED_OPTIONS, makeSeedDeps())
  const after = await getQuota('motn')
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\n=== Seed finished — stopped because: ${result.stoppedReason} ===`)
  console.log(`Seeded:                 ${result.seeded}`)
  console.log(`Skipped (already in DB): ${result.skipped}`)
  console.log(`Failed (marked pending): ${result.failed}`)
  console.log(`MOTN calls used this run: ${after.callsUsed - before.callsUsed}`)
  console.log(`Quota now:               ${after.callsUsed}/${after.callsLimit} (remaining ${after.remaining})`)
  console.log(`Time:                    ${elapsed}s`)

  if (result.stoppedReason === 'rate-limit') {
    console.warn('\n⚠ Stopped on a 429 rate-limit. Re-run later; already-seeded titles are skipped.')
  }
}
