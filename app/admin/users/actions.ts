'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { changeRoleCore, inviteUserCore } from '@/lib/admin/users-service'
import type { UserRole } from '@/lib/auth/roles'
import type { FlagServiceResult } from '@/lib/admin/flags-service'

export async function changeUserRole(
  userId: string,
  newRole: UserRole
): Promise<FlagServiceResult> {
  const user = await requireRole('admin')
  const result = await changeRoleCore(createAdminClient(), {
    userId,
    newRole,
    actor: { id: user.id, role: user.role },
  })
  if (result.ok) revalidatePath('/admin/users')
  return result
}

export async function inviteUser(email: string, role: UserRole): Promise<FlagServiceResult> {
  await requireRole('admin')
  const base = process.env.NEXT_PUBLIC_SITE_URL
  const result = await inviteUserCore(createAdminClient(), {
    email,
    role,
    redirectTo: base ? `${base.replace(/\/+$/, '')}/accept-invite` : undefined,
  })
  if (result.ok) revalidatePath('/admin/users')
  return result
}
