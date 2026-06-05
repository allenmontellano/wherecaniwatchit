import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCached, setCached, titleCacheKey, DETAIL_TTL } from '@/lib/cache'
import { captureException } from '@/lib/observability'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const cacheKey = titleCacheKey(id)
  const cached = await getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  const supabase = createAdminClient()

  const { data: title, error: titleError } = await supabase
    .from('titles')
    .select('*')
    .eq('id', id)
    .single()

  if (titleError || !title) {
    return NextResponse.json({ error: 'Title not found' }, { status: 404 })
  }

  const { data: availability, error: availError } = await supabase
    .from('availability')
    .select('*, platform:platforms(*)')
    .eq('title_id', id)
    .eq('available', true)
    .order('region_code')

  if (availError) {
    captureException(availError, { op: 'titles.availability', id })
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 })
  }

  const payload = { title, availability: availability ?? [] }
  await setCached(cacheKey, payload, DETAIL_TTL)
  return NextResponse.json(payload)
}
