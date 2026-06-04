export interface TMDBSearchResult {
  id: number
  media_type: 'movie' | 'tv'
  title?: string        // movies
  name?: string         // tv shows
  overview: string
  poster_path: string | null
  release_date?: string    // "YYYY-MM-DD"
  first_air_date?: string  // "YYYY-MM-DD"
  vote_average: number
  genre_ids: number[]
}

export interface TMDBMovieDetail {
  id: number
  imdb_id: string | null
  title: string
  overview: string
  poster_path: string | null
  release_date: string
  vote_average: number
  runtime: number | null
  genres: Array<{ id: number; name: string }>
}

export interface TMDBTVDetail {
  id: number
  name: string
  overview: string
  poster_path: string | null
  first_air_date: string
  vote_average: number
  number_of_seasons: number
  genres: Array<{ id: number; name: string }>
  external_ids: { imdb_id: string | null }
}

export interface TMDBCredits {
  cast: Array<{ name: string; order: number }>
  crew: Array<{ name: string; job: string }>
}

export interface TMDBMovieDetailFull extends TMDBMovieDetail {
  credits?: TMDBCredits
  production_companies?: Array<{ name: string }>
  production_countries?: Array<{ iso_3166_1: string; name: string }>
  original_language?: string
  spoken_languages?: Array<{ iso_639_1: string; english_name: string }>
  status?: string
  release_dates?: {
    results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }>
  }
}

export interface TMDBTVDetailFull extends TMDBTVDetail {
  credits?: TMDBCredits
  created_by?: Array<{ name: string }>
  networks?: Array<{ name: string }>
  origin_country?: string[]
  number_of_episodes?: number
  status?: string
  original_language?: string
  spoken_languages?: Array<{ iso_639_1: string; english_name: string }>
  content_ratings?: { results: Array<{ iso_3166_1: string; rating: string }> }
}
