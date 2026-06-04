import type { AvailabilityWithPlatform } from '@/types/database'

export function formatRuntime(minutes: number): string | null {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function formatExtent(t: {
  type: 'movie' | 'tv'
  season_count: number | null
  runtime: number | null
}): string | null {
  if (t.type === 'tv') {
    if (!t.season_count) return null
    return `${t.season_count} season${t.season_count === 1 ? '' : 's'}`
  }
  return t.runtime ? formatRuntime(t.runtime) : null
}

export function groupByRegion(
  availability: AvailabilityWithPlatform[]
): Record<string, AvailabilityWithPlatform[]> {
  return availability.reduce<Record<string, AvailabilityWithPlatform[]>>((acc, a) => {
    ;(acc[a.region_code] ??= []).push(a)
    return acc
  }, {})
}
