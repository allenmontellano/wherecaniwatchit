import Link from 'next/link'
import { cookies } from 'next/headers'
import { AnimatedBackground } from '@/components/home/animated-background'
import { Logo } from '@/components/logo'
import { CompactSearchForm } from '@/components/search/compact-search-form'
import { ResultsSection } from '@/components/search/results-section'
import { SUPPORTED_COUNTRIES, type CountryCode, resolveCountry } from '@/lib/country'

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

async function fetchSearch(query: string): Promise<{ results: SyncedResult[]; query: string }> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(query)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}


export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string }>
}) {
  const { q, country: countryParam } = await searchParams
  const cookieStore = await cookies()
  const savedCountry = cookieStore.get('selected-country')?.value
  const country = resolveCountry(countryParam, savedCountry)

  if (!q) {
    return (
      <main
        className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <AnimatedBackground />
        <div className="relative z-10 text-center px-4">
          <p className="text-lg text-[#717177]" style={{ fontFamily: 'var(--font-display)' }}>
            Enter a search query to get started.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-[#2B72E8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] rounded"
          >
            ← Back to search
          </Link>
        </div>
      </main>
    )
  }

  let data: { results: SyncedResult[]; query: string }
  try {
    data = await fetchSearch(q)
  } catch {
    return (
      <main
        className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <AnimatedBackground />
        <div className="relative z-10 text-center px-4">
          <p
            className="text-xl font-semibold text-[#171717] mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Search failed
          </p>
          <p className="text-sm text-[#717177] mb-4">Something went wrong. Please try again.</p>
          <Link
            href="/"
            className="text-sm text-[#2B72E8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] rounded"
          >
            ← Back to search
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <AnimatedBackground />

      {/* Sticky header */}
      <header
        className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-2.5"
        style={{
          background: 'rgba(255, 255, 255, 0.86)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(229, 229, 229, 0.55)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.03)',
        }}
      >
        <Link href="/" aria-label="Home" className="flex-shrink-0">
          <Logo width={110} />
        </Link>
        <div className="flex-1 max-w-lg">
          <CompactSearchForm initialQuery={q} initialCountry={country} />
        </div>
      </header>

      {/* Results */}
      <div className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 pb-16">
        <ResultsSection results={data.results} query={data.query} country={country} />
      </div>
    </main>
  )
}
