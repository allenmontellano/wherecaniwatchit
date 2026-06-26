import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { AnimatedBackground } from '@/components/home/animated-background'
import { CountryProvider } from '@/components/country/country-context'
import { SiteHeader } from '@/components/layout/site-header'
import { TitleDetail } from '@/components/title/title-detail'
import { resolveCountry } from '@/lib/country'
import { getTitleDetail } from '@/lib/title-detail'
import { getRegionPlatformsMap } from '@/lib/platforms-data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const detail = await getTitleDetail(id).catch(() => null)
  if (!detail) return { title: 'Title — Where Can I Watch It?' }
  return {
    title: `${detail.title.title} — Where Can I Watch It?`,
    description: detail.title.synopsis ?? `Find where to watch ${detail.title.title} online.`,
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
  const [detail, platformsByRegion] = await Promise.all([
    getTitleDetail(id),
    getRegionPlatformsMap(),
  ])
  if (!detail) notFound()
  const { title, availability } = detail

  return (
    <CountryProvider initial={country}>
      <main
        className="relative min-h-dvh flex flex-col overflow-hidden"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <AnimatedBackground />
        <SiteHeader initialQuery={title.title} />
        <div className="relative z-10 flex-1">
          <TitleDetail title={title} availability={availability} platformsByRegion={platformsByRegion} />
        </div>
      </main>
    </CountryProvider>
  )
}
