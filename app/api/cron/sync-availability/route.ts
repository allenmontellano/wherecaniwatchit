import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchShowByTMDBId, LAUNCH_REGIONS } from '@/lib/streaming/client'
import { hasRemainingQuota, resetQuota } from '@/lib/quota'
import { selectTitlesToRefresh, type RefreshTitle } from '@/lib/cron-select'
import { delCached, titleCacheKey } from '@/lib/cache'
import type { Platform } from '@/types/database'

const SA_TO_DB: Record<string, string> = {
  ph: 'PH', us: 'US', gb: 'GB', au: 'AU', ca: 'CA',
}

const PER_RUN_CAP = 50
const STALE_DAYS = 30

function asRefreshTitle(raw: unknown): RefreshTitle | null {
  const t = (Array.isArray(raw) ? raw[0] : raw) as RefreshTitle | null
  // Local titles (null tmdb_id) can't be refreshed via MOTN — skip them.
  return t && t.id && t.tmdb_id != null ? t : null
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // On the first day of the month, explicitly reset the MOTN counter.
  // (Quota rows are month-keyed, so this is a safety net more than a necessity.)
  if (new Date().getUTCDate() === 1) {
    await resetQuota('motn')
  }

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Flagged titles get priority for re-checking.
  const { data: flaggedRows } = await supabase
    .from('flags')
    .select('titles!inner(id, tmdb_id, type)')
    .eq('status', 'pending')
    .limit(PER_RUN_CAP)

  // Time-stale availability rows.
  const { data: staleRows } = await supabase
    .from('availability')
    .select('titles!inner(id, tmdb_id, type)')
    .lt('last_verified', cutoff)
    .limit(PER_RUN_CAP * 2)

  const flagged = (flaggedRows ?? [])
    .map((r) => asRefreshTitle((r as { titles: unknown }).titles))
    .filter((t): t is RefreshTitle => t !== null)
  const stale = (staleRows ?? [])
    .map((r) => asRefreshTitle((r as { titles: unknown }).titles))
    .filter((t): t is RefreshTitle => t !== null)

  const titles = selectTitlesToRefresh(flagged, stale, PER_RUN_CAP)
  if (titles.length === 0) {
    return NextResponse.json({ refreshed: 0, message: 'Nothing to refresh' })
  }

  const { data: platforms } = await supabase.from('platforms').select('*')
  const bySlug = new Map<string, Platform>((platforms ?? []).map((p) => [p.slug, p as Platform]))

  let refreshed = 0
  let stoppedForQuota = false
  for (const title of titles) {
    if (!(await hasRemainingQuota('motn'))) {
      stoppedForQuota = true
      break
    }

    const mediaType = title.type === 'tv' ? 'tv' : 'movie'
    const saShow = await fetchShowByTMDBId(title.tmdb_id, mediaType)
    if (!saShow) continue

    for (const saRegion of LAUNCH_REGIONS) {
      const dbRegion = SA_TO_DB[saRegion]
      if (!dbRegion) continue

      for (const option of saShow.streamingOptions[saRegion] ?? []) {
        if (option.type !== 'subscription' && option.type !== 'free') continue
        const platform = bySlug.get(option.service.id)
        if (!platform) continue

        await supabase.from('availability').upsert(
          {
            title_id: title.id,
            platform_id: platform.id,
            region_code: dbRegion,
            available: true,
            last_verified: new Date().toISOString(),
            source: 'cron',
          },
          { onConflict: 'title_id,platform_id,region_code' }
        )
      }
    }

    // Availability changed — drop the title's detail cache so it re-fetches.
    await delCached(titleCacheKey(title.id))
    refreshed++
  }

  return NextResponse.json({ refreshed, stoppedForQuota })
}
