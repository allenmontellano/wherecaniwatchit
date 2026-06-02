export interface StreamingService {
  id: string
  name: string
  homePage: string
  imageSet: {
    lightThemeImage: string
    darkThemeImage: string
  }
}

export interface StreamingOption {
  service: StreamingService
  type: 'subscription' | 'rent' | 'buy' | 'free' | 'addon'
  quality?: string
  link: string
  expiresSoon: boolean
  expiresOn?: string
}

export interface SAShow {
  itemType: 'show'
  showType: 'movie' | 'series'
  id: string
  imdbId: string
  tmdbId: string
  title: string
  overview: string
  releaseYear?: number
  firstAirYear?: number
  genres: Array<{ id: string; name: string }>
  rating?: number
  seasonCount?: number
  imageSet: {
    verticalPoster?: {
      w240: string; w360: string; w480: string; w600: string; w720: string
    }
  }
  // Keys are lowercase country codes: 'us', 'gb', 'au', 'ca', 'ph'
  streamingOptions: Record<string, StreamingOption[]>
}
