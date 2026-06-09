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

async function assembleResults(
  supabase: ReturnType<typeof createAdminClient>,
  titles: Title[]
): Promise<SyncedResult[]> {
  if (titles.length === 0) return []
  const ids = titles.map((t) => t.id)
  const { data: avail, error } = await supabase
    .from('availability')
    .select('title_id, region_code, platform:platforms(slug)')
    .in('title_id', ids)
    .eq('available', true)
  if (error) throw new Error(`Local availability load failed: ${error.message}`)
  const grouped = groupAvailabilityByRegion((avail ?? []) as AvailabilityJoinRow[])
  return titles.map((title) => ({ title, availabilityByRegion: grouped.get(title.id) ?? {} }))
}

export async function searchByFts(query: string, year: number | null, limit: number): Promise<SyncedResult[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('search_titles_fts', { q: query, y: year, lim: limit })
  if (error) throw new Error(`FTS search failed: ${error.message}`)
  return assembleResults(supabase, (data ?? []) as Title[])
}

export async function searchByFuzzy(query: string, year: number | null, limit: number): Promise<SyncedResult[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('search_titles_fuzzy', { q: query, y: year, lim: limit, threshold: 0.3 })
  if (error) throw new Error(`Fuzzy search failed: ${error.message}`)
  return assembleResults(supabase, (data ?? []) as Title[])
}
