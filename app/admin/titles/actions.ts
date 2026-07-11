'use server'

import { revalidatePath } from 'next/cache'
import { withRole } from '@/lib/auth/with-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { delCached, titleCacheKey } from '@/lib/cache'
import { syncTitle } from '@/lib/sync'
import {
  saveTitleOverridesCore,
  resetTitleOverrideCore,
  addLocalTitleCore,
} from '@/lib/admin/titles-service'
import type { FlagServiceResult } from '@/lib/admin/flags-service'
import type { TMDBSearchResult } from '@/lib/tmdb/types'
import type { TitleType } from '@/types/database'

function deps() {
  return {
    supabase: createAdminClient(),
    dropTitleCache: (titleId: string) => delCached(titleCacheKey(titleId)),
  }
}

export const saveTitleOverrides = withRole(
  'admin',
  async (user, titleId: string, changes: Record<string, unknown>): Promise<FlagServiceResult> => {
    const result = await saveTitleOverridesCore(deps(), {
      titleId,
      changes,
      actor: { id: user.id, role: user.role },
    })
    if (result.ok) revalidatePath(`/admin/titles/${titleId}`)
    return result
  }
)

export const resetTitleOverride = withRole(
  'admin',
  async (user, titleId: string, key: string): Promise<FlagServiceResult> => {
    const result = await resetTitleOverrideCore(deps(), {
      titleId,
      key,
      actor: { id: user.id, role: user.role },
    })
    if (result.ok) revalidatePath(`/admin/titles/${titleId}`)
    return result
  }
)

export const addLocalTitle = withRole(
  'admin',
  async (
    user,
    fields: { title: string; type: TitleType; release_year?: number | null; synopsis?: string | null }
  ): Promise<FlagServiceResult & { titleId?: string }> => {
    const result = await addLocalTitleCore(deps(), {
      fields,
      actor: { id: user.id, role: user.role },
    })
    if (result.ok) revalidatePath('/admin/titles')
    return result
  }
)

export const addTitleByTmdbId = withRole(
  'admin',
  async (
    _user,
    tmdbId: number,
    type: TitleType
  ): Promise<FlagServiceResult & { titleId?: string }> => {
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return { ok: false, error: 'Enter a valid TMDB id.' }
    }
    try {
      const result = await syncTitle({
        id: tmdbId,
        media_type: type,
        overview: '',
        poster_path: null,
        vote_average: 0,
        genre_ids: [],
      } as TMDBSearchResult)
      revalidatePath('/admin/titles')
      return { ok: true, titleId: result.title.id }
    } catch {
      return { ok: false, error: 'Could not fetch that title from TMDB.' }
    }
  }
)

export const resyncTitle = withRole(
  'admin',
  async (_user, titleId: string): Promise<FlagServiceResult> => {
    const supabase = createAdminClient()
    const { data: title } = await supabase
      .from('titles')
      .select('tmdb_id, type')
      .eq('id', titleId)
      .single()
    if (!title) return { ok: false, error: 'Title not found.' }
    if (title.tmdb_id == null) {
      return { ok: false, error: 'Local titles have no TMDB source to re-sync from.' }
    }
    try {
      await syncTitle({
        id: title.tmdb_id,
        media_type: title.type as TitleType,
        overview: '',
        poster_path: null,
        vote_average: 0,
        genre_ids: [],
      } as TMDBSearchResult)
      await delCached(titleCacheKey(titleId))
      revalidatePath(`/admin/titles/${titleId}`)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Re-sync failed — TMDB may be unavailable.' }
    }
  }
)
