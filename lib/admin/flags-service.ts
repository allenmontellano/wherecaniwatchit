import type { SupabaseClient } from '@supabase/supabase-js'
import { computeConfidence } from '@/lib/confidence'
import { sanitizeWatchUrl } from '@/lib/flags'
import type { UserRole } from '@/lib/auth/roles'

export interface FlagServiceDeps {
  supabase: SupabaseClient
  dropTitleCache: (titleId: string) => Promise<void> | void
}

export interface FlagActor {
  id: string
  role: UserRole
}

export interface AcceptFlagInput {
  flagId: string
  titleId: string
  platformId: string
  regionCode: string
  available: boolean
  watchUrl?: string | null
  actor: FlagActor
}

export interface RejectFlagInput {
  flagId: string
  actor: FlagActor
}

export type FlagServiceResult = { ok: true } | { ok: false; error: string }

function actorSource(role: UserRole): 'contributor' | 'reviewer' {
  return role === 'contributor' ? 'contributor' : 'reviewer'
}

export async function acceptFlagCore(
  deps: FlagServiceDeps,
  input: AcceptFlagInput
): Promise<FlagServiceResult> {
  const { supabase, dropTitleCache } = deps
  const { flagId, titleId, platformId, regionCode, available, watchUrl, actor } = input

  if (!flagId || !titleId || !platformId || !regionCode) {
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

  const source = actorSource(actor.role)
  const confidence = computeConfidence({
    source,
    platformSlug: platform.slug,
    regionCode,
  })
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

  const { error: flagError } = await supabase
    .from('flags')
    .update({
      status: 'resolved',
      resolution: 'accepted',
      reviewed_by: actor.id,
      reviewed_at: now,
    })
    .eq('id', flagId)
  if (flagError) return { ok: false, error: 'Could not update the flag.' }

  await supabase.rpc('increment_contribution', { p_user_id: actor.id, p_n: 1 })
  await dropTitleCache(titleId)
  return { ok: true }
}

export async function rejectFlagCore(
  deps: FlagServiceDeps,
  input: RejectFlagInput
): Promise<FlagServiceResult> {
  const { supabase } = deps
  const { flagId, actor } = input
  if (!flagId) return { ok: false, error: 'Missing flag id.' }

  const { error } = await supabase
    .from('flags')
    .update({
      status: 'reviewed',
      resolution: 'rejected',
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', flagId)
  if (error) return { ok: false, error: 'Could not update the flag.' }

  await supabase.rpc('increment_contribution', { p_user_id: actor.id, p_n: 1 })
  return { ok: true }
}
