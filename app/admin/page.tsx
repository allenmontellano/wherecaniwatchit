import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AvailabilityConfidence } from '@/types/database'

export const dynamic = 'force-dynamic'

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-[16px] border border-[#E5E5E5] px-5 py-4 flex flex-col gap-0.5">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8]">
        {label}
      </span>
      <span
        className="text-[26px] font-bold"
        style={{ fontFamily: 'var(--font-display)', color: tone ?? '#171717' }}
      >
        {value}
      </span>
    </div>
  )
}

async function countWhere(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  filters: Record<string, string>
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true })
  for (const [col, val] of Object.entries(filters)) q = q.eq(col, val)
  const { count } = await q
  return count ?? 0
}

export default async function AdminOverviewPage() {
  const user = await requireRole(['contributor', 'reviewer', 'admin'])
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('contribution_count')
    .eq('user_id', user.id)
    .single()

  let stats: {
    pendingFlags: number
    pendingApproval: number
    confidence: Record<AvailabilityConfidence, number>
    contributors: { username: string; role: string; contribution_count: number }[]
  } | null = null

  if (user.role === 'admin') {
    const admin = createAdminClient()
    const [pendingFlags, pendingApproval, high, medium, low, { data: contributors }] =
      await Promise.all([
        countWhere(admin, 'flags', { status: 'pending' }),
        countWhere(admin, 'availability', { confidence: 'medium', source: 'contributor' }),
        countWhere(admin, 'availability', { confidence: 'high' }),
        countWhere(admin, 'availability', { confidence: 'medium' }),
        countWhere(admin, 'availability', { confidence: 'low' }),
        admin
          .from('profiles')
          .select('username, role, contribution_count')
          .order('contribution_count', { ascending: false })
          .limit(25),
      ])
    stats = {
      pendingFlags,
      pendingApproval,
      confidence: { high, medium, low },
      contributors: contributors ?? [],
    }
  }

  return (
    <div className="max-w-[780px]">
      <h1
        className="text-[22px] font-bold text-[#171717]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Overview
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1 mb-6">
        Internal CMS — data accuracy tools for wherecaniwatchit.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Your contributions" value={profile?.contribution_count ?? 0} />
        {stats && (
          <>
            <StatCard label="Pending reports" value={stats.pendingFlags} />
            <StatCard label="Awaiting approval" value={stats.pendingApproval} />
            <StatCard label="High confidence" value={stats.confidence.high} tone="#34C759" />
            <StatCard label="Medium confidence" value={stats.confidence.medium} />
            <StatCard
              label="Low confidence (Disney+ PH etc.)"
              value={stats.confidence.low}
              tone="#FF3B30"
            />
          </>
        )}
      </div>

      {stats && (
        <section className="rounded-[16px] border border-[#E5E5E5] px-5 py-4">
          <h2
            className="text-[15px] font-bold text-[#171717] mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Contributions by user
          </h2>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8]">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium text-right">Contributions</th>
              </tr>
            </thead>
            <tbody>
              {stats.contributors.map((c) => (
                <tr key={c.username} className="border-t border-[#F0F0F0]">
                  <td className="py-2 text-[#171717] font-medium">{c.username}</td>
                  <td className="py-2 text-[#717177] capitalize">{c.role}</td>
                  <td className="py-2 text-right text-[#171717]">{c.contribution_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
