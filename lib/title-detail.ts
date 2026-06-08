import { createAdminClient } from '@/lib/supabase/admin'
import { getCached, setCached, titleCacheKey, DETAIL_TTL } from '@/lib/cache'
import { captureException } from '@/lib/observability'
import type { Title, AvailabilityWithPlatform } from '@/types/database'

export interface TitleDetail {
  title: Title
  availability: AvailabilityWithPlatform[]
}

// Shared title-detail logic used by both the API route and the title page
// (called directly, server-side — no HTTP self-fetch). Cache-first.
// Returns null when the title does not exist; throws on a DB error.
export async function getTitleDetail(id: string): Promise<TitleDetail | null> {
  const cacheKey = titleCacheKey(id)
  const cached = await getCached<TitleDetail>(cacheKey)
  if (cached) return cached

  const supabase = createAdminClient()

  const { data: title, error: titleError } = await supabase
    .from('titles')
    .select('*')
    .eq('id', id)
    .single()

  if (titleError || !title) return null

  const { data: availability, error: availError } = await supabase
    .from('availability')
    .select('*, platform:platforms(*)')
    .eq('title_id', id)
    .eq('available', true)
    .order('region_code')

  if (availError) {
    captureException(availError, { op: 'titles.availability', id })
    throw new Error('Failed to load availability')
  }

  const payload: TitleDetail = {
    title: title as Title,
    availability: (availability ?? []) as AvailabilityWithPlatform[],
  }
  await setCached(cacheKey, payload, DETAIL_TTL)
  return payload
}
