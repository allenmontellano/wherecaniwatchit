'use server'

import { revalidatePath } from 'next/cache'
import { withRole } from '@/lib/auth/with-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { delCached, titleCacheKey } from '@/lib/cache'
import {
  writeAvailabilityCore,
  confirmAvailabilityCore,
} from '@/lib/admin/availability-service'
import type { FlagServiceResult } from '@/lib/admin/flags-service'

export interface WriteAvailabilityFormInput {
  titleId: string
  platformId: string
  regionCode: string
  available: boolean
  watchUrl?: string
}

function deps() {
  return {
    supabase: createAdminClient(),
    dropTitleCache: (titleId: string) => delCached(titleCacheKey(titleId)),
  }
}

export const writeAvailability = withRole(
  ['contributor', 'reviewer', 'admin'],
  async (user, input: WriteAvailabilityFormInput): Promise<FlagServiceResult> => {
    const result = await writeAvailabilityCore(deps(), {
      ...input,
      actor: { id: user.id, role: user.role },
    })
    if (result.ok) revalidatePath(`/admin/availability/${input.titleId}`)
    return result
  }
)

export const confirmAvailability = withRole(
  ['reviewer', 'admin'],
  async (user, availabilityId: string): Promise<FlagServiceResult> => {
    const result = await confirmAvailabilityCore(deps(), {
      availabilityId,
      actor: { id: user.id, role: user.role },
    })
    if (result.ok) revalidatePath('/admin/pending')
    return result
  }
)
