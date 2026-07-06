export const LAUNCH_REGION_CODES = ['PH', 'US', 'GB', 'AU', 'CA'] as const

const SLUG_RE = /^[a-z0-9-]+$/

export interface PlatformInput {
  name: string
  slug: string
  regions: string[]
  logoUrl?: string | null
}

export type PlatformValidation = { ok: true } | { ok: false; error: string }

export function validatePlatformInput(input: PlatformInput): PlatformValidation {
  if (!input.name.trim()) return { ok: false, error: 'A platform name is required.' }
  if (!SLUG_RE.test(input.slug)) {
    return { ok: false, error: 'Slug must be lowercase letters, digits, and hyphens only.' }
  }
  if (input.regions.length === 0) {
    return { ok: false, error: 'Pick at least one region.' }
  }
  const known = new Set<string>(LAUNCH_REGION_CODES)
  if (input.regions.some((r) => !known.has(r))) {
    return { ok: false, error: 'Unknown region code.' }
  }
  return { ok: true }
}
