import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Title, AvailabilityWithPlatform } from '@/types/database'

const REGION_ORDER = ['PH', 'US', 'GB', 'AU', 'CA']

async function fetchTitle(id: string): Promise<{ title: Title; availability: AvailabilityWithPlatform[] }> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${base}/api/titles/${id}`, { cache: 'no-store' })
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error('Failed to load title')
  return res.json()
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { title, availability } = await fetchTitle(id)

  const byRegion = availability.reduce<Record<string, AvailabilityWithPlatform[]>>(
    (acc, a) => { (acc[a.region_code] ??= []).push(a); return acc },
    {}
  )

  return (
    <main>
      {title.poster_url && (
        <Image src={title.poster_url} alt={title.title} width={200} height={300} />
      )}
      <h1>{title.title}</h1>
      <p>
        {title.type === 'tv'
          ? `TV Series · ${title.season_count ?? '?'} seasons`
          : 'Movie'}
        {title.release_year && ` · ${title.release_year}`}
        {title.imdb_rating && ` · ★ ${title.imdb_rating}`}
      </p>
      {title.synopsis && <p>{title.synopsis}</p>}

      <h2>Streaming Availability</h2>
      {REGION_ORDER.map((region) => (
        <div key={region}>
          <h3>{region}</h3>
          {!byRegion[region]?.length ? (
            <p>Not available</p>
          ) : (
            <ul>
              {byRegion[region].map((a) => (
                <li key={a.id}>
                  {a.platform.name}
                  {/* Flag button — Phase 2 */}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </main>
  )
}
