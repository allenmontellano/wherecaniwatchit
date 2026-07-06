'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { validatePlatformInput, type PlatformInput } from '@/lib/admin/platforms-service'
import type { FlagServiceResult } from '@/lib/admin/flags-service'

export async function createPlatform(input: PlatformInput): Promise<FlagServiceResult> {
  await requireRole('admin')
  const valid = validatePlatformInput(input)
  if (!valid.ok) return valid

  const supabase = createAdminClient()
  const { error } = await supabase.from('platforms').insert({
    name: input.name.trim(),
    slug: input.slug,
    logo_url: input.logoUrl?.trim() || null,
    supported_regions: input.regions,
  })
  if (error) return { ok: false, error: 'Could not create the platform (slug may already exist).' }
  revalidatePath('/admin/platforms')
  return { ok: true }
}

export async function updatePlatform(
  platformId: string,
  input: Omit<PlatformInput, 'slug'>
): Promise<FlagServiceResult> {
  await requireRole('admin')
  const valid = validatePlatformInput({ ...input, slug: 'placeholder' })
  if (!valid.ok) return valid

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('platforms')
    .update({
      name: input.name.trim(),
      logo_url: input.logoUrl?.trim() || null,
      supported_regions: input.regions,
    })
    .eq('id', platformId)
  if (error) return { ok: false, error: 'Could not update the platform.' }
  revalidatePath('/admin/platforms')
  return { ok: true }
}
