import Link from 'next/link'

interface SyncedResult {
  title: {
    id: string
    title: string
    type: string
    release_year: number | null
    poster_url: string | null
    imdb_rating: number | null
    season_count: number | null
    synopsis: string | null
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
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  if (!q) return <main><p>Enter a search query.</p></main>

  let data: { results: SyncedResult[]; query: string }
  try {
    data = await fetchSearch(q)
  } catch {
    return <main><p>Search failed. Please try again.</p></main>
  }

  return (
    <main>
      <h1>Results for: {data.query}</h1>
      {data.results.length === 0 && <p>No results found.</p>}
      <ul>
        {data.results.map(({ title, availabilityByRegion }) => (
          <li key={title.id}>
            <Link href={`/titles/${title.id}`}>
              <strong>{title.title}</strong>
            </Link>
            {' '}
            ({title.type === 'tv'
              ? `TV · ${title.season_count ?? '?'} seasons`
              : 'Movie'})
            {title.release_year && ` · ${title.release_year}`}
            {title.imdb_rating && ` · ★ ${title.imdb_rating}`}
            <br />
            {Object.entries(availabilityByRegion).map(([region, slugs]) => (
              <span key={region}>
                [{region}: {slugs.join(', ') || 'not available'}]{' '}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </main>
  )
}
