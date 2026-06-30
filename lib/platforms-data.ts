import { createAdminClient } from '@/lib/supabase/admin'

export interface RegionPlatform {
  slug: string
  name: string
}

export function buildRegionPlatformsMap(
  rows: { slug: string; name: string; supported_regions: string[] }[]
): Record<string, RegionPlatform[]> {
  const map: Record<string, RegionPlatform[]> = {}
  for (const row of rows) {
    for (const region of row.supported_regions) {
      ;(map[region] ??= []).push({ slug: row.slug, name: row.name })
    }
  }
  for (const region of Object.keys(map)) {
    map[region].sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

export async function getRegionPlatformsMap(): Promise<Record<string, RegionPlatform[]>> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('platforms').select('slug, name, supported_regions')
  return buildRegionPlatformsMap(data ?? [])
}

export async function getRegionPlatformSlugs(region: string): Promise<Set<string>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('platforms')
    .select('slug')
    .contains('supported_regions', [region])
  return new Set((data ?? []).map((r: { slug: string }) => r.slug))
}
