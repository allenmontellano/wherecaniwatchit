import type { TMDBCredits } from './types'

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  PH: 'Philippines',
  KR: 'South Korea',
  JP: 'Japan',
  FR: 'France',
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  tl: 'Filipino',
}

export function extractCast(credits: TMDBCredits | undefined): string[] | null {
  if (!credits?.cast?.length) return null
  return [...credits.cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, 6)
    .map((c) => c.name)
}

export function extractCreatorsMovie(credits: TMDBCredits | undefined): string[] | null {
  const dirs = credits?.crew?.filter((c) => c.job === 'Director').map((c) => c.name) ?? []
  return dirs.length ? dirs : null
}

export function extractCreatorsTV(
  createdBy: Array<{ name: string }> | undefined
): string[] | null {
  return createdBy?.length ? createdBy.map((c) => c.name) : null
}

export function extractNetworkTV(networks: Array<{ name: string }> | undefined): string | null {
  return networks?.[0]?.name ?? null
}

export function extractNetworkMovie(
  companies: Array<{ name: string }> | undefined
): string | null {
  return companies?.[0]?.name ?? null
}

export function extractTVCertification(
  cr: { results: Array<{ iso_3166_1: string; rating: string }> } | undefined
): string | null {
  const us = cr?.results?.find((r) => r.iso_3166_1 === 'US')
  return us?.rating || null
}

export function extractMovieCertification(
  rd:
    | { results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> }
    | undefined
): string | null {
  const us = rd?.results?.find((r) => r.iso_3166_1 === 'US')
  return us?.release_dates?.map((d) => d.certification).find(Boolean) ?? null
}

export function extractOriginCountryTV(codes: string[] | undefined): string | null {
  const c = codes?.[0]
  return c ? COUNTRY_NAMES[c] ?? c : null
}

export function extractOriginCountryMovie(
  countries: Array<{ iso_3166_1: string; name: string }> | undefined
): string | null {
  return countries?.[0]?.name ?? null
}

export function languageName(iso: string | undefined): string | null {
  if (!iso) return null
  return LANG_NAMES[iso] ?? iso
}
