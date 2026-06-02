import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchShowByTMDBId, LAUNCH_REGIONS } from '@/lib/streaming/client'
import type { Platform } from '@/types/database'

const SA_TO_DB: Record<string, string> = {
  ph: 'PH', us: 'US', gb: 'GB', au: 'AU', ca: 'CA',
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

  // Fetch stale availability records (up to 50 titles per cron run)
  const { data: stale } = await supabase
    .from('availability')
    .select('title_id, titles!inner(id, tmdb_id, type)')
    .lt('last_verified', cutoff)
    .limit(50)

  if (!stale?.length) {
    return NextResponse.json({ refreshed: 0, message: 'Nothing to refresh' })
  }

  const { data: platforms } = await supabase.from('platforms').select('*')
  const bySlug = new Map<string, Platform>(
    (platforms ?? []).map((p) => [p.slug, p as Platform])
  )

  // Deduplicate titles
  const seen = new Set<string>()
  const titles: Array<{ id: string; tmdb_id: number; type: string }> = []
  for (const row of stale) {
    const raw = row.titles as unknown
    const t = (Array.isArray(raw) ? raw[0] : raw) as { id: string; tmdb_id: number; type: string } | null
    if (!t || seen.has(t.id)) continue
    seen.add(t.id)
    titles.push(t)
  }

  let refreshed = 0
  for (const title of titles) {
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
    refreshed++
  }

  return NextResponse.json({ refreshed })
}
