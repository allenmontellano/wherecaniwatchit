'use server'

import { revalidatePath } from 'next/cache'
import { withRole } from '@/lib/auth/with-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { changeRoleCore, inviteUserCore } from '@/lib/admin/users-service'
import type { UserRole } from '@/lib/auth/roles'
import type { FlagServiceResult } from '@/lib/admin/flags-service'

export const changeUserRole = withRole(
  'admin',
  async (user, userId: string, newRole: UserRole): Promise<FlagServiceResult> => {
    const result = await changeRoleCore(createAdminClient(), {
      userId,
      newRole,
      actor: { id: user.id, role: user.role },
    })
    if (result.ok) revalidatePath('/admin/users')
    return result
  }
)

export const inviteUser = withRole(
  'admin',
  async (_user, email: string, role: UserRole): Promise<FlagServiceResult> => {
    const base = process.env.NEXT_PUBLIC_SITE_URL
    const result = await inviteUserCore(createAdminClient(), {
      email,
      role,
      redirectTo: base ? `${base.replace(/\/+$/, '')}/accept-invite` : undefined,
    })
    if (result.ok) revalidatePath('/admin/users')
    return result
  }
)
