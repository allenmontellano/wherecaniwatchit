import type { SupabaseClient } from '@supabase/supabase-js'
import { writeAvailabilityCore } from '@/lib/admin/availability-service'
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

export async function acceptFlagCore(
  deps: FlagServiceDeps,
  input: AcceptFlagInput
): Promise<FlagServiceResult> {
  const { flagId, titleId, platformId, regionCode, available, watchUrl, actor } = input

  if (!flagId || !titleId || !platformId || !regionCode) {
    return { ok: false, error: 'Missing required fields.' }
  }

  const write = await writeAvailabilityCore(deps, {
    titleId,
    platformId,
    regionCode,
    available,
    watchUrl,
    actor,
  })
  if (!write.ok) return write

  const { error: flagError } = await deps.supabase
    .from('flags')
    .update({
      status: 'resolved',
      resolution: 'accepted',
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', flagId)
  if (flagError) return { ok: false, error: 'Could not update the flag.' }

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
