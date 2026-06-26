'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAcceptInviteInput, resolveInviteRole } from '@/lib/auth/accept-invite'

export async function acceptInvite(formData: FormData): Promise<{ error: string } | never> {
  const parsed = parseAcceptInviteInput({
    username: String(formData.get('username') ?? ''),
    password: String(formData.get('password') ?? ''),
    regionCode: String(formData.get('regionCode') ?? ''),
  })
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Your invite link has expired. Ask an admin to re-invite you.' }

  const { error: pwError } = await supabase.auth.updateUser({ password: parsed.value.password })
  if (pwError) return { error: 'Could not set your password. Please try again.' }

  const role = resolveInviteRole(user.app_metadata)
  const admin = createAdminClient()
  const { error: insertError } = await admin.from('profiles').insert({
    user_id: user.id,
    username: parsed.value.username,
    region_code: parsed.value.regionCode,
    role,
  })
  if (insertError) {
    if (insertError.code === '23505') return { error: 'That username is already taken.' }
    return { error: 'Could not finish setting up your account. Please try again.' }
  }

  redirect('/account')
}
