import { createAdminClient } from '@/lib/supabase/admin'
import type { SyncedResult } from '@/types/search'
import type { Title } from '@/types/database'

type PlatformRef = { slug: string } | { slug: string }[] | null

export interface AvailabilityJoinRow {
  title_id: string
  region_code: string
  platform: PlatformRef
}

export function groupAvailabilityByRegion(
  rows: AvailabilityJoinRow[]
): Map<string, Record<string, string[]>> {
  const byTitle = new Map<string, Record<string, string[]>>()
  for (const row of rows) {
    const platform = Array.isArray(row.platform) ? row.platform[0] : row.platform
    if (!platform?.slug) continue
    const regions = byTitle.get(row.title_id) ?? {}
    ;(regions[row.region_code] ??= []).push(platform.slug)
    byTitle.set(row.title_id, regions)
  }
  return byTitle
}

export async function searchLocalTitles(query: string, limit: number): Promise<SyncedResult[]> {
  const supabase = createAdminClient()

  const { data: titles, error } = await supabase
    .from('titles')
    .select('*')
    .ilike('title', `%${query}%`)
    .limit(limit)

  if (error) throw new Error(`Local title search failed: ${error.message}`)
  if (!titles?.length) return []

  const ids = titles.map((t) => t.id)
  const { data: avail, error: availError } = await supabase
    .from('availability')
    .select('title_id, region_code, platform:platforms(slug)')
    .in('title_id', ids)
    .eq('available', true)

  if (availError) throw new Error(`Local availability load failed: ${availError.message}`)

  const grouped = groupAvailabilityByRegion((avail ?? []) as AvailabilityJoinRow[])

  return (titles as Title[]).map((title) => ({
    title,
    availabilityByRegion: grouped.get(title.id) ?? {},
  }))
}
