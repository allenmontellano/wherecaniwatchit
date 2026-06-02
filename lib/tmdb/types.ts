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
