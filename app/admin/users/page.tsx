import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { UsersManager, type ManagedUser } from '@/components/admin/users-manager'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const me = await requireRole('admin')
  const supabase = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, role, region_code, contribution_count, joined_at')
    .order('joined_at')

  return (
    <div className="max-w-[720px]">
      <h1
        className="text-[22px] font-bold text-[#171717]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Users &amp; invites
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1 mb-6">
        Invite-only — contributors and reviewers join by email invite.
      </p>
      <UsersManager users={(profiles ?? []) as ManagedUser[]} selfId={me.id} />
    </div>
  )
}
