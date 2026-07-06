import { computeConfidence } from '@/lib/confidence'
import { sanitizeWatchUrl } from '@/lib/flags'
import type { FlagActor, FlagServiceDeps, FlagServiceResult } from '@/lib/admin/flags-service'

export interface WriteAvailabilityInput {
  titleId: string
  platformId: string
  regionCode: string
  available: boolean
  watchUrl?: string | null
  actor: FlagActor
}

export interface ConfirmAvailabilityInput {
  availabilityId: string
  actor: FlagActor
}

export async function writeAvailabilityCore(
  deps: FlagServiceDeps,
  input: WriteAvailabilityInput
): Promise<FlagServiceResult> {
  const { supabase, dropTitleCache } = deps
  const { titleId, platformId, regionCode, available, watchUrl, actor } = input

  if (!titleId || !platformId || !regionCode) {
    return { ok: false, error: 'Missing required fields.' }
  }

  const urlResult = sanitizeWatchUrl(watchUrl)
  if (!urlResult.ok) return { ok: false, error: urlResult.error }

  const { data: platform, error: platformError } = await supabase
    .from('platforms')
    .select('slug')
    .eq('id', platformId)
    .single()
  if (platformError || !platform) return { ok: false, error: 'Platform not found.' }

  const source = actor.role === 'contributor' ? 'contributor' : 'reviewer'
  const confidence = computeConfidence({ source, platformSlug: platform.slug, regionCode })
  const now = new Date().toISOString()
  const reviewerLevel = source === 'reviewer'

  const { error: upsertError } = await supabase.from('availability').upsert(
    {
      title_id: titleId,
      platform_id: platformId,
      region_code: regionCode,
      available,
      watch_url: urlResult.value,
      last_verified: now,
      source,
      confidence,
      reviewed_by: reviewerLevel ? actor.id : null,
      reviewed_at: reviewerLevel ? now : null,
    },
    { onConflict: 'title_id,platform_id,region_code' }
  )
  if (upsertError) return { ok: false, error: 'Could not save availability.' }

  await supabase.rpc('increment_contribution', { p_user_id: actor.id, p_n: 1 })
  await dropTitleCache(titleId)
  return { ok: true }
}

export async function confirmAvailabilityCore(
  deps: FlagServiceDeps,
  input: ConfirmAvailabilityInput
): Promise<FlagServiceResult> {
  const { supabase, dropTitleCache } = deps
  const { availabilityId, actor } = input
  if (!availabilityId) return { ok: false, error: 'Missing availability id.' }

  const { data: row, error } = await supabase
    .from('availability')
    .update({
      confidence: 'high',
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', availabilityId)
    .select('title_id')
    .single()
  if (error || !row) return { ok: false, error: 'Could not confirm this row.' }

  await supabase.rpc('increment_contribution', { p_user_id: actor.id, p_n: 1 })
  await dropTitleCache(row.title_id)
  return { ok: true }
}
