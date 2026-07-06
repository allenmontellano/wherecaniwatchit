import type { SupabaseClient } from '@supabase/supabase-js'
import { isUserRole, type UserRole } from '@/lib/auth/roles'
import type { FlagActor, FlagServiceResult } from '@/lib/admin/flags-service'

export interface ChangeRoleInput {
  userId: string
  newRole: UserRole
  actor: FlagActor
}

export interface InviteUserInput {
  email: string
  role: UserRole
  redirectTo?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function changeRoleCore(
  supabase: SupabaseClient,
  input: ChangeRoleInput
): Promise<FlagServiceResult> {
  const { userId, newRole } = input
  if (!userId || !isUserRole(newRole)) {
    return { ok: false, error: 'Invalid user or role.' }
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()
  if (!target) return { ok: false, error: 'User not found.' }

  if (target.role === 'admin' && newRole !== 'admin') {
    const { count } = await supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return { ok: false, error: 'Cannot demote the last admin.' }
    }
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: newRole },
  })
  if (authError) return { ok: false, error: 'Could not update the auth role.' }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('user_id', userId)
  if (profileError) return { ok: false, error: 'Auth role updated but profile update failed.' }

  return { ok: true }
}

export async function inviteUserCore(
  supabase: SupabaseClient,
  input: InviteUserInput
): Promise<FlagServiceResult> {
  const email = (input.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (!isUserRole(input.role)) return { ok: false, error: 'Invalid role.' }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    email,
    input.redirectTo ? { redirectTo: input.redirectTo } : undefined
  )
  if (error || !data.user) return { ok: false, error: 'Could not send the invite.' }

  const { error: roleError } = await supabase.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: input.role },
  })
  if (roleError) {
    return {
      ok: false,
      error: `Invite sent but setting the role failed (user ${data.user.id}) — set it manually.`,
    }
  }
  return { ok: true }
}
