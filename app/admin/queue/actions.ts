'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { delCached, titleCacheKey } from '@/lib/cache'
import {
  acceptFlagCore,
  rejectFlagCore,
  type FlagServiceResult,
} from '@/lib/admin/flags-service'

export interface AcceptFlagFormInput {
  flagId: string
  titleId: string
  platformId: string
  regionCode: string
  available: boolean
  watchUrl?: string
}

export async function acceptFlag(input: AcceptFlagFormInput): Promise<FlagServiceResult> {
  const user = await requireRole(['contributor', 'reviewer', 'admin'])
  const result = await acceptFlagCore(
    {
      supabase: createAdminClient(),
      dropTitleCache: (titleId) => delCached(titleCacheKey(titleId)),
    },
    { ...input, actor: { id: user.id, role: user.role } }
  )
  if (result.ok) revalidatePath('/admin/queue')
  return result
}

export async function rejectFlag(flagId: string): Promise<FlagServiceResult> {
  const user = await requireRole(['contributor', 'reviewer', 'admin'])
  const result = await rejectFlagCore(
    { supabase: createAdminClient(), dropTitleCache: () => {} },
    { flagId, actor: { id: user.id, role: user.role } }
  )
  if (result.ok) revalidatePath('/admin/queue')
  return result
}
