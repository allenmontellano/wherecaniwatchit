import { createAdminClient } from '@/lib/supabase/admin'
import type { PlatformCheckerConfig, AvailabilityStrategy } from './config'

export interface TitleInfo {
  imdb_id: string | null
  title: string
  release_year: number | null
  watch_url?: string | null
}

export interface CheckerOptions {
  onCircuitBreak: (regionCode: string, errorRate: number) => void
  batchSize?: number
  batchDelayMs?: number
}

export interface CheckerResult {
  checked: number
  errors: number
  stopped: boolean
}

const CIRCUIT_BREAKER_THRESHOLD = 0.2
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_BATCH_DELAY_MS = 1000

export function buildCheckUrl(
  platform: PlatformCheckerConfig,
  title: { watch_url: string | null; imdb_id: string | null; title: string; release_year: number | null }
): string | null {
  const s = platform.urlStrategy
  switch (s.type) {
    case 'stored':
      return title.watch_url
    case 'imdb_template':
      return title.imdb_id ? s.template.replace('{imdb_id}', title.imdb_id) : null
    case 'title_search': {
      const url = new URL(s.searchBase)
      url.searchParams.set('q', title.title)
      return url.toString()
    }
  }
}

export function interpretResponse(strategy: AvailabilityStrategy, status: number): boolean {
  switch (strategy.type) {
    case 'status_200':      return status === 200
    case 'not_404':         return status !== 404
    case 'no_redirect_to':  return true  // requires redirect URL inspection — treated as available by default
  }
}

interface AvailabilityRecord {
  id: string
  available: boolean
  consecutive_failures: number
  watch_url: string | null
  platform: { slug: string } | null
  title: { imdb_id: string | null; title: string; release_year: number | null } | null
}

export async function runCheckerBatch(
  regionCode: string,
  platforms: PlatformCheckerConfig[],
  options: CheckerOptions
): Promise<CheckerResult> {
  const { onCircuitBreak, batchSize = DEFAULT_BATCH_SIZE, batchDelayMs = DEFAULT_BATCH_DELAY_MS } = options
  const supabase = createAdminClient()

  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
  const platformBySlug = new Map(platforms.map((p) => [p.slug, p]))

  const { data: records } = await supabase
    .from('availability')
    .select('*, platform:platforms(slug), title:titles(imdb_id, title, release_year)')
    .eq('region_code', regionCode)
    .lt('last_verified', cutoff)
    .limit(100) as { data: AvailabilityRecord[] | null }

  if (!records?.length) return { checked: 0, errors: 0, stopped: false }

  // Filter to platforms covered by this checker's config
  const relevant = records.filter((r) => r.platform && platformBySlug.has(r.platform.slug))

  let checked = 0
  let errors = 0
  let stopped = false

  const processRecord = async (record: AvailabilityRecord): Promise<void> => {
    const platform = record.platform ? platformBySlug.get(record.platform.slug) : undefined
    if (!platform) { errors++; return }

    const titleInfo = {
      watch_url: record.watch_url,
      imdb_id: record.title?.imdb_id ?? null,
      title: record.title?.title ?? '',
      release_year: record.title?.release_year ?? null,
    }

    const url = buildCheckUrl(platform, titleInfo)
    if (!url) { errors++; return }

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      })

      const available = interpretResponse(platform.availabilityStrategy, res.status)
      checked++

      if (available) {
        await supabase
          .from('availability')
          .update({ available: true, consecutive_failures: 0, last_verified: new Date().toISOString(), source: 'checker' })
          .eq('id', record.id)
      } else {
        const newFailures = (record.consecutive_failures ?? 0) + 1
        await supabase
          .from('availability')
          .update({
            available: newFailures >= 2 ? false : record.available,
            consecutive_failures: newFailures,
            last_verified: new Date().toISOString(),
            source: 'checker',
          })
          .eq('id', record.id)
      }
    } catch {
      // Network error / timeout — preserve existing availability state
      errors++
    }
  }

  for (let i = 0; i < relevant.length && !stopped; i += batchSize) {
    const batch = relevant.slice(i, i + batchSize)
    await Promise.all(batch.map(processRecord))

    const processed = Math.min(i + batchSize, relevant.length)
    const errorRate = processed > 0 ? errors / processed : 0

    if (errorRate > CIRCUIT_BREAKER_THRESHOLD) {
      stopped = true
      onCircuitBreak(regionCode, errorRate)
      break
    }

    if (i + batchSize < relevant.length && batchDelayMs > 0) {
      await new Promise((r) => setTimeout(r, batchDelayMs))
    }
  }

  return { checked, errors, stopped }
}
