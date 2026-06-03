import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { Star, Clock, Calendar, Tv, Film, ChevronLeft } from 'lucide-react'
import { AnimatedBackground } from '@/components/home/animated-background'
import { Logo } from '@/components/logo'
import { AvailabilityTabs } from '@/components/title/availability-tabs'
import { formatRuntime } from '@/lib/title-utils'
import type { Title, AvailabilityWithPlatform } from '@/types/database'

const SUPPORTED = ['PH', 'US', 'GB', 'AU', 'CA'] as const
type CountryCode = (typeof SUPPORTED)[number]

async function fetchTitle(
  id: string
): Promise<{ title: Title; availability: AvailabilityWithPlatform[] }> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${base}/api/titles/${id}`, { cache: 'no-store' })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load title')
  return res.json()
}

function resolveCountry(
  urlParam: string | undefined,
  cookieValue: string | undefined
): CountryCode {
  if (urlParam && SUPPORTED.includes(urlParam as CountryCode)) return urlParam as CountryCode
  if (cookieValue && SUPPORTED.includes(cookieValue as CountryCode)) return cookieValue as CountryCode
  return 'PH'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const { title } = await fetchTitle(id)
    return {
      title: `${title.title} — Where Can I Watch It?`,
      description: title.synopsis ?? `Find where to watch ${title.title} online.`,
    }
  } catch {
    return { title: 'Title — Where Can I Watch It?' }
  }
}

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ country?: string }>
}) {
  const [{ id }, { country: countryParam }, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ])

  const savedCountry = cookieStore.get('selected-country')?.value
  const country = resolveCountry(countryParam, savedCountry)
  const { title, availability } = await fetchTitle(id)

  const isTV = title.type === 'tv'
  const runtime = title.runtime ? formatRuntime(title.runtime) : null

  return (
    <main
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <AnimatedBackground />

      {/* Sticky back-nav header */}
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
        <Link
          href={`/search?q=${encodeURIComponent(title.title)}&country=${country}`}
          className="flex items-center gap-1.5 text-sm text-[#717177] hover:text-[#2B72E8] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] rounded"
          aria-label="Back to search results"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <div className="flex-1 flex justify-center">
          <Link href="/" aria-label="Home">
            <Logo width={100} />
          </Link>
        </div>
        {/* Spacer to balance the back link */}
        <div className="w-14" aria-hidden="true" />
      </header>

      {/* Content */}
      <div className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 pb-16">

        {/* Hero */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 md:gap-10 mb-10">

          {/* Poster */}
          <div className="w-full max-w-[280px] mx-auto md:mx-0">
            <div
              className="relative w-full rounded-2xl overflow-hidden"
              style={{
                aspectRatio: '2/3',
                background: '#F5F5F7',
                boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              {title.poster_url ? (
                <Image
                  src={title.poster_url}
                  alt={title.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 280px, 320px"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#AEAEB8]">
                  {isTV ? <Tv className="w-14 h-14" /> : <Film className="w-14 h-14" />}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col justify-start pt-0 md:pt-2">
            {/* Type + year badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase"
                style={{
                  background: isTV ? 'rgba(43,114,232,0.10)' : 'rgba(23,23,23,0.07)',
                  color: isTV ? '#2B72E8' : '#171717',
                }}
              >
                {isTV ? 'Series' : 'Movie'}
              </span>
              {title.release_year && (
                <span className="flex items-center gap-1 text-[11px] text-[#717177]">
                  <Calendar className="w-3 h-3" />
                  {title.release_year}
                </span>
              )}
              {runtime && (
                <span className="flex items-center gap-1 text-[11px] text-[#717177]">
                  <Clock className="w-3 h-3" />
                  {runtime}
                </span>
              )}
              {isTV && title.season_count && (
                <span className="text-[11px] text-[#717177]">
                  {title.season_count} {title.season_count === 1 ? 'season' : 'seasons'}
                </span>
              )}
              {title.imdb_rating && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#171717]">
                  <Star className="w-3 h-3 fill-[#F5C518] stroke-none" />
                  {title.imdb_rating}
                  <span className="text-[#AEAEB8] font-normal">/10</span>
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-3xl sm:text-4xl font-bold text-[#171717] leading-tight mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title.title}
            </h1>

            {/* Genres */}
            {title.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {title.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-[#717177]"
                    style={{ background: 'rgba(245,245,247,0.9)', border: '1px solid rgba(229,229,229,0.8)' }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            {title.synopsis && (
              <p className="text-sm text-[#717177] leading-relaxed mb-6 max-w-prose">
                {title.synopsis}
              </p>
            )}

            {/* Availability tabs — desktop inline */}
            <div className="hidden md:block">
              <AvailabilityTabs availability={availability} initialCountry={country} />
            </div>
          </div>
        </div>

        {/* Availability tabs — mobile below hero */}
        <div className="md:hidden">
          <AvailabilityTabs availability={availability} initialCountry={country} />
        </div>
      </div>
    </main>
  )
}
