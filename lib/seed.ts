import type { TMDBSearchResult } from '@/lib/tmdb/types'

export interface SeedDeps {
  syncTitle: (result: TMDBSearchResult) => Promise<unknown>
  hasRemainingQuota: () => Promise<boolean>
  markPending: (tmdbId: number, title: string, type: 'movie' | 'tv') => Promise<void>
  sleep: (ms: number) => Promise<void>
  log: (message: string) => void
}

export interface SeedOptions {
  batchSize: number
  delayMs: number
  maxTitles: number
}

export type SeedStopReason = 'completed' | 'quota' | 'rate-limit' | 'max-titles'

export interface SeedResult {
  seeded: number
  skipped: number
  failed: number
  stoppedReason: SeedStopReason
}

function titleOf(c: TMDBSearchResult): string {
  return c.name ?? c.title ?? `tmdb:${c.id}`
}

function isRateLimit(err: unknown): boolean {
  return err instanceof Error && err.message.includes('429')
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function seedTitles(
  candidates: TMDBSearchResult[],
  existing: Set<number>,
  opts: SeedOptions,
  deps: SeedDeps
): Promise<SeedResult> {
  // De-duplicate within the run and drop titles already in the database.
  const seen = new Set<number>()
  const queue: TMDBSearchResult[] = []
  let skipped = 0
  for (const c of candidates) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    if (existing.has(c.id)) {
      skipped++
      continue
    }
    queue.push(c)
  }

  let seeded = 0
  let failed = 0
  let stoppedReason: SeedStopReason = 'completed'

  outer: for (let i = 0; i < queue.length; i += opts.batchSize) {
    if (!(await deps.hasRemainingQuota())) {
      stoppedReason = 'quota'
      break
    }

    const batch = queue.slice(i, i + opts.batchSize)
    for (const c of batch) {
      if (seeded >= opts.maxTitles) {
        stoppedReason = 'max-titles'
        break outer
      }
      try {
        await deps.syncTitle(c)
        seeded++
        deps.log(`Seeded ${seeded}/${opts.maxTitles} — ${titleOf(c)}`)
      } catch (err) {
        if (isRateLimit(err)) {
          stoppedReason = 'rate-limit'
          break outer
        }
        failed++
        await deps.markPending(c.id, titleOf(c), c.media_type)
        deps.log(`Failed ${c.id} (${titleOf(c)}): ${messageOf(err)}`)
      }
    }

    if (i + opts.batchSize < queue.length) await deps.sleep(opts.delayMs)
  }

  return { seeded, skipped, failed, stoppedReason }
}
