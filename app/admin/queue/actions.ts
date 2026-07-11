'use server'

import { revalidatePath } from 'next/cache'
import { withRole } from '@/lib/auth/with-role'
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

export const acceptFlag = withRole(
  ['contributor', 'reviewer', 'admin'],
  async (user, input: AcceptFlagFormInput): Promise<FlagServiceResult> => {
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
)

export const rejectFlag = withRole(
  ['contributor', 'reviewer', 'admin'],
  async (user, flagId: string): Promise<FlagServiceResult> => {
    const result = await rejectFlagCore(
      { supabase: createAdminClient(), dropTitleCache: () => {} },
      { flagId, actor: { id: user.id, role: user.role } }
    )
    if (result.ok) revalidatePath('/admin/queue')
    return result
  }
)
