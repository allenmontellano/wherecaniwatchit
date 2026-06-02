import { NextRequest, NextResponse } from 'next/server'
import { searchTMDB } from '@/lib/tmdb/client'
import { syncTitle } from '@/lib/sync'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    )
  }

  if (query.length > 200) {
    return NextResponse.json(
      { error: 'Query too long' },
      { status: 400 }
    )
  }

  try {
    const tmdbResults = await searchTMDB(query)
    const topResults = tmdbResults.slice(0, 5)

    const synced = await Promise.all(
      topResults.map((result) =>
        syncTitle(result).catch((err) => {
          console.error(`Failed to sync tmdb:${result.id}`, err)
          return null
        })
      )
    )

    return NextResponse.json({ results: synced.filter(Boolean), query })
  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 })
  }
}
