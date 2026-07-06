import { LOW_CONFIDENCE_RULES } from '@/lib/confidence'

export interface QueueSortable {
  id: string
  created_at: string
  region_code: string | null
  reported_platform: string | null
}

function isKnownRisk(flag: QueueSortable): boolean {
  if (!flag.region_code || !flag.reported_platform) return false
  return LOW_CONFIDENCE_RULES.some(
    (r) =>
      r.platformSlugs.includes(flag.reported_platform as string) &&
      r.regionCodes.includes(flag.region_code as string)
  )
}

export function sortQueueFlags<T extends QueueSortable>(flags: T[]): T[] {
  return [...flags].sort((a, b) => {
    const riskDiff = Number(isKnownRisk(b)) - Number(isKnownRisk(a))
    if (riskDiff !== 0) return riskDiff
    return a.created_at.localeCompare(b.created_at)
  })
}
