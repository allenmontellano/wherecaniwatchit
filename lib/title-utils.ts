import type { AvailabilityWithPlatform } from '@/types/database'

export function formatRuntime(minutes: number): string | null {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function groupByRegion(
  availability: AvailabilityWithPlatform[]
): Record<string, AvailabilityWithPlatform[]> {
  return availability.reduce<Record<string, AvailabilityWithPlatform[]>>((acc, a) => {
    ;(acc[a.region_code] ??= []).push(a)
    return acc
  }, {})
}
