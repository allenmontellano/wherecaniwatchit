export const SUPPORTED_COUNTRIES = ['PH', 'US', 'GB', 'AU', 'CA'] as const
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]

export interface RegionMeta {
  code: CountryCode
  name: string
  flag: string // flagcdn slug (lowercase)
}

export const REGIONS: RegionMeta[] = [
  { code: 'PH', name: 'Philippines', flag: 'ph' },
  { code: 'US', name: 'United States', flag: 'us' },
  { code: 'GB', name: 'United Kingdom', flag: 'gb' },
  { code: 'AU', name: 'Australia', flag: 'au' },
  { code: 'CA', name: 'Canada', flag: 'ca' },
]

export const regionByCode: Record<CountryCode, RegionMeta> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r])
) as Record<CountryCode, RegionMeta>

export function resolveCountry(
  urlParam: string | undefined,
  cookieValue: string | undefined
): CountryCode {
  if (urlParam && SUPPORTED_COUNTRIES.includes(urlParam as CountryCode))
    return urlParam as CountryCode
  if (cookieValue && SUPPORTED_COUNTRIES.includes(cookieValue as CountryCode))
    return cookieValue as CountryCode
  return 'PH'
}
