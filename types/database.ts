export type TitleType = 'movie' | 'tv'
export type FlagType = 'incorrect' | 'outdated' | 'missing'
export type FlagStatus = 'pending' | 'reviewed' | 'resolved'

export interface Region {
  id: string
  country_code: string
  country_name: string
  display_order: number
  created_at: string
}

export interface Platform {
  id: string
  name: string
  slug: string
  logo_url: string | null
  supported_regions: string[]
  created_at: string
}

export interface Title {
  id: string
  tmdb_id: number
  title: string
  type: TitleType
  genres: string[]
  runtime: number | null
  release_year: number | null
  synopsis: string | null
  poster_url: string | null
  imdb_rating: number | null
  imdb_id: string | null
  season_count: number | null
  created_at: string
  updated_at: string
}

export interface Availability {
  id: string
  title_id: string
  platform_id: string
  region_code: string
  available: boolean
  last_verified: string
  source: string
  created_at: string
  updated_at: string
}

export interface AvailabilityWithPlatform extends Availability {
  platform: Platform
}

export interface Profile {
  user_id: string
  username: string
  region_code: string | null
  contribution_count: number
  reputation_score: number
  joined_at: string
}

export interface Flag {
  id: string
  availability_id: string
  flag_type: FlagType
  status: FlagStatus
  user_id: string | null
  ip_hash: string
  notes: string | null
  created_at: string
  updated_at: string
}
