import type { FlagActor, FlagServiceDeps, FlagServiceResult } from '@/lib/admin/flags-service'
import type { TitleType } from '@/types/database'

const PROTECTED_KEYS = new Set(['id', 'tmdb_id', 'metadata_overrides', 'created_at', 'updated_at', 'seed_status'])

export interface SaveTitleOverridesInput {
  titleId: string
  changes: Record<string, unknown>
  actor: FlagActor
}

export interface ResetTitleOverrideInput {
  titleId: string
  key: string
  actor: FlagActor
}

export interface AddLocalTitleInput {
  fields: { title: string; type: TitleType } & Record<string, unknown>
  actor: FlagActor
}

export async function saveTitleOverridesCore(
  deps: FlagServiceDeps,
  input: SaveTitleOverridesInput
): Promise<FlagServiceResult> {
  const { supabase, dropTitleCache } = deps
  const { titleId, changes, actor } = input

  const keys = Object.keys(changes)
  if (!titleId || keys.length === 0) {
    return { ok: false, error: 'Nothing to save.' }
  }
  if (keys.some((k) => PROTECTED_KEYS.has(k))) {
    return { ok: false, error: 'That field cannot be overridden.' }
  }

  const { data: existing, error: readError } = await supabase
    .from('titles')
    .select('metadata_overrides')
    .eq('id', titleId)
    .single()
  if (readError || !existing) return { ok: false, error: 'Title not found.' }

  const overrides = {
    ...((existing.metadata_overrides as Record<string, unknown> | null) ?? {}),
    ...changes,
  }

  const { error: updateError } = await supabase
    .from('titles')
    .update({ ...changes, metadata_overrides: overrides })
    .eq('id', titleId)
  if (updateError) return { ok: false, error: 'Could not save the title.' }

  await supabase.rpc('increment_contribution', { p_user_id: actor.id, p_n: 1 })
  await dropTitleCache(titleId)
  return { ok: true }
}

export async function resetTitleOverrideCore(
  deps: FlagServiceDeps,
  input: ResetTitleOverrideInput
): Promise<FlagServiceResult> {
  const { supabase, dropTitleCache } = deps
  const { titleId, key } = input
  if (!titleId || !key) return { ok: false, error: 'Missing title or field.' }

  const { data: existing, error: readError } = await supabase
    .from('titles')
    .select('metadata_overrides')
    .eq('id', titleId)
    .single()
  if (readError || !existing) return { ok: false, error: 'Title not found.' }

  const overrides = {
    ...((existing.metadata_overrides as Record<string, unknown> | null) ?? {}),
  }
  delete overrides[key]

  const { error: updateError } = await supabase
    .from('titles')
    .update({ metadata_overrides: overrides })
    .eq('id', titleId)
  if (updateError) return { ok: false, error: 'Could not reset the override.' }

  await dropTitleCache(titleId)
  return { ok: true }
}

export async function addLocalTitleCore(
  deps: FlagServiceDeps,
  input: AddLocalTitleInput
): Promise<FlagServiceResult & { titleId?: string }> {
  const { supabase } = deps
  const { fields, actor } = input

  const name = (fields.title ?? '').trim()
  if (!name) return { ok: false, error: 'A title name is required.' }
  if (fields.type !== 'movie' && fields.type !== 'tv') {
    return { ok: false, error: 'Type must be movie or tv.' }
  }

  const { data: inserted, error } = await supabase
    .from('titles')
    .insert({ ...fields, title: name, tmdb_id: null })
    .select('id')
    .single()
  if (error || !inserted) return { ok: false, error: 'Could not create the title.' }

  await supabase.rpc('increment_contribution', { p_user_id: actor.id, p_n: 1 })
  return { ok: true, titleId: inserted.id as string }
}
