import Link from 'next/link'
import { cookies } from 'next/headers'
import { AnimatedBackground } from '@/components/home/animated-background'
import { CountryProvider } from '@/components/country/country-context'
import { SiteHeader } from '@/components/layout/site-header'
import { ResultsSection } from '@/components/search/results-section'
import { resolveCountry } from '@/lib/country'
import type { SyncedResult } from '@/types/search'

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
    <CountryProvider initial={country}>
      <main
        className="relative min-h-dvh flex flex-col overflow-hidden"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <AnimatedBackground />
        <SiteHeader initialQuery={q} />
        <div className="relative z-10 flex-1 w-full max-w-[880px] mx-auto px-4 min-[721px]:px-6 pt-8 pb-24">
          <ResultsSection results={data.results} query={data.query} />
        </div>
      </main>
    </CountryProvider>
  )
}
