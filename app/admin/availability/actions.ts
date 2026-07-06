'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
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

export async function writeAvailability(
  input: WriteAvailabilityFormInput
): Promise<FlagServiceResult> {
  const user = await requireRole(['contributor', 'reviewer', 'admin'])
  const result = await writeAvailabilityCore(deps(), {
    ...input,
    actor: { id: user.id, role: user.role },
  })
  if (result.ok) revalidatePath(`/admin/availability/${input.titleId}`)
  return result
}

export async function confirmAvailability(availabilityId: string): Promise<FlagServiceResult> {
  const user = await requireRole(['reviewer', 'admin'])
  const result = await confirmAvailabilityCore(deps(), {
    availabilityId,
    actor: { id: user.id, role: user.role },
  })
  if (result.ok) revalidatePath('/admin/pending')
  return result
}
