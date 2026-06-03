'use client'

import { Search } from 'lucide-react'
import { ResultCard } from './result-card'

interface SyncedResult {
  title: {
    id: string
    title: string
    type: string
    release_year: number | null
    poster_url: string | null
    imdb_rating: number | null
    season_count: number | null
  }
  availabilityByRegion: Record<string, string[]>
}

interface ResultsSectionProps {
  results: SyncedResult[]
  query: string
  country: string
}

export function ResultsSection({ results, query, country }: ResultsSectionProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(43,114,232,0.08)' }}
        >
          <Search className="w-6 h-6 text-[#2B72E8]" />
        </div>
        <p
          className="text-xl font-semibold text-[#171717] mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          No results for &ldquo;{query}&rdquo;
        </p>
        <p className="text-sm text-[#717177] max-w-xs">
          Try a different spelling, or search for a related title.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-[#717177] mb-5 font-sans">
        {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
        <span className="font-semibold text-[#171717]">&ldquo;{query}&rdquo;</span>
        <span className="ml-1.5 text-[#AEAEB8]">· {country}</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {results.map((result, i) => (
          <ResultCard
            key={result.title.id}
            title={result.title}
            availabilityByRegion={result.availabilityByRegion}
            country={country}
            index={i}
          />
        ))}
      </div>
    </div>
  )
}
