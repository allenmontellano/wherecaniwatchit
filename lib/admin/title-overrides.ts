export type OverrideWarning = 'none' | 'stable' | 'airing'

export function stripOverriddenKeys<T extends Record<string, unknown>>(
  fresh: T,
  overrides: Record<string, unknown>
): Partial<T> {
  const overriddenKeys = new Set(Object.keys(overrides))
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(fresh)) {
    if (!overriddenKeys.has(key)) {
      result[key as keyof T] = value as T[keyof T]
    }
  }
  return result
}

const STABLE_STATUSES = new Set(['ended', 'released', 'canceled'])

export function overrideWarning(status: string | null, hasTmdbId: boolean): OverrideWarning {
  if (!hasTmdbId) return 'none'
  if (status && STABLE_STATUSES.has(status.toLowerCase())) return 'stable'
  return 'airing'
}
