import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export default async function AdminOverviewPage() {
  const user = await requireRole(['contributor', 'reviewer', 'admin'])
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('contribution_count')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="max-w-[720px]">
      <h1
        className="text-[22px] font-bold text-[#171717]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Overview
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1">
        Internal CMS — data accuracy tools for wherecaniwatchit.
      </p>
      <div className="mt-6 rounded-[16px] border border-[#E5E5E5] px-5 py-4 inline-flex flex-col gap-0.5">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8]">
          Your contributions
        </span>
        <span
          className="text-[28px] font-bold text-[#171717]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {profile?.contribution_count ?? 0}
        </span>
      </div>
    </div>
  )
}
