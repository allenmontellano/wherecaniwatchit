// URL strategy: how to find the URL to HEAD-request for a title
export type UrlStrategy =
  | { type: 'stored' }                                       // use watch_url from DB (SA API link)
  | { type: 'imdb_template'; template: string }              // replace {imdb_id} in template string
  | { type: 'title_search'; searchBase: string }             // append ?q={encoded_title}

// Availability strategy: how to interpret the HTTP response
export type AvailabilityStrategy =
  | { type: 'status_200' }                                   // available iff HTTP 200
  | { type: 'not_404' }                                      // available unless 404
  | { type: 'no_redirect_to'; loginPattern: string }         // unavailable if redirect URL contains pattern

export interface PlatformCheckerConfig {
  slug: string            // must match platforms.slug in DB
  name: string
  urlStrategy: UrlStrategy
  availabilityStrategy: AvailabilityStrategy
}

export interface RegionCheckerConfig {
  regionCode: string      // DB region code, e.g. 'PH'
  edgeRegion: string      // Vercel region slug, e.g. 'sin1'
  platforms: PlatformCheckerConfig[]
}

// Shared across all regions — use watch_url stored from SA API
const SHARED_PLATFORMS: PlatformCheckerConfig[] = [
  { slug: 'netflix',     name: 'Netflix',     urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  { slug: 'disney',      name: 'Disney+',     urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  { slug: 'prime',       name: 'Prime Video', urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  { slug: 'apple',       name: 'Apple TV+',   urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  { slug: 'crunchyroll', name: 'Crunchyroll', urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  { slug: 'mubi',        name: 'Mubi',        urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  { slug: 'viki',        name: 'Viki',        urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
]

export const PH_CONFIG: RegionCheckerConfig = {
  regionCode: 'PH',
  edgeRegion: 'sin1',
  platforms: [
    ...SHARED_PLATFORMS,
    { slug: 'vivamax',  name: 'Vivamax',  urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'iwanttfc', name: 'iWantTFC', urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'viu',      name: 'Viu',      urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'wetv',     name: 'WeTV',     urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  ],
}

export const US_CONFIG: RegionCheckerConfig = {
  regionCode: 'US',
  edgeRegion: 'iad1',
  platforms: [
    ...SHARED_PLATFORMS,
    { slug: 'hulu',    name: 'Hulu',     urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'peacock', name: 'Peacock',  urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'max',     name: 'Max',      urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  ],
}

export const GB_CONFIG: RegionCheckerConfig = {
  regionCode: 'GB',
  edgeRegion: 'lhr1',
  platforms: [
    ...SHARED_PLATFORMS,
    { slug: 'itvx',        name: 'ITVX',       urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'nowtv',       name: 'Now TV',      urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'bbc-iplayer', name: 'BBC iPlayer', urlStrategy: { type: 'title_search', searchBase: 'https://www.bbc.co.uk/iplayer/search' }, availabilityStrategy: { type: 'not_404' } },
  ],
}

export const AU_CONFIG: RegionCheckerConfig = {
  regionCode: 'AU',
  edgeRegion: 'syd1',
  platforms: [
    ...SHARED_PLATFORMS,
    { slug: 'stan',  name: 'Stan',  urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'binge', name: 'Binge', urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
  ],
}

export const CA_CONFIG: RegionCheckerConfig = {
  regionCode: 'CA',
  edgeRegion: 'yul1',
  platforms: [
    ...SHARED_PLATFORMS,
    { slug: 'crave',   name: 'Crave',   urlStrategy: { type: 'stored' }, availabilityStrategy: { type: 'status_200' } },
    { slug: 'cbc-gem', name: 'CBC Gem', urlStrategy: { type: 'title_search', searchBase: 'https://gem.cbc.ca/search' }, availabilityStrategy: { type: 'not_404' } },
  ],
}

export const ALL_REGION_CONFIGS: RegionCheckerConfig[] = [
  PH_CONFIG, US_CONFIG, GB_CONFIG, AU_CONFIG, CA_CONFIG,
]
