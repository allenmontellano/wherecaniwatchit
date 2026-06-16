import { createAdminClient } from '@/lib/supabase/admin'
import { isUserRole, USER_ROLES, type UserRole } from '@/lib/auth/roles'

export type ParsedInvite =
  | { ok: true; email: string; role: UserRole }
  | { ok: false; error: string }

export function parseInviteArgs(argv: string[]): ParsedInvite {
  const [email, role] = argv
  if (!email || !role) return { ok: false, error: 'Usage: invite <email> <role>' }
  if (!email.includes('@')) return { ok: false, error: 'Invalid email address.' }
  if (!isUserRole(role)) {
    return { ok: false, error: `Role must be one of: ${USER_ROLES.join(', ')}.` }
  }
  return { ok: true, email, role }
}

export function inviteRedirectUrl(base: string): string {
  return `${base.replace(/\/+$/, '')}/accept-invite`
}

async function main() {
  const parsed = parseInviteArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(1)
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL
  if (!base) {
    console.error('NEXT_PUBLIC_SITE_URL must be set (the app base URL for the invite link).')
    process.exit(1)
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.email, {
    redirectTo: inviteRedirectUrl(base),
  })
  if (error || !data.user) {
    console.error('Invite failed:', error?.message ?? 'no user returned')
    process.exit(1)
  }

  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: parsed.role },
  })
  if (roleError) {
    console.error('Invite sent but failed to set role:', roleError.message)
    process.exit(1)
  }

  console.log(`Invited ${parsed.email} as ${parsed.role}.`)
}

if (process.argv[1] && process.argv[1].endsWith('invite.ts')) {
  void main()
}
