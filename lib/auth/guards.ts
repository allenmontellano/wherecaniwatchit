import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isUserRole, type UserRole } from '@/lib/auth/roles'

export interface SessionUser {
  id: string
  email: string | null
  role: UserRole
  username: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !isUserRole(profile.role)) return null

  return { id: user.id, email: user.email ?? null, role: profile.role, username: profile.username }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(roles: UserRole | UserRole[]): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles]
  const user = await requireUser()
  if (!allowed.includes(user.role)) redirect('/account')
  return user
}
