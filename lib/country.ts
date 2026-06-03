export const SUPPORTED_COUNTRIES = ['PH', 'US', 'GB', 'AU', 'CA'] as const
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]

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
