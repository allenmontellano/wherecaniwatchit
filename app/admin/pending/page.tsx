import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { PendingList, type PendingRow } from '@/components/admin/pending-list'

export const dynamic = 'force-dynamic'

export default async function PendingApprovalPage() {
  await requireRole(['reviewer', 'admin'])
  const supabase = createAdminClient()

  const { data: rows } = await supabase
    .from('availability')
    .select(
      'id, region_code, available, watch_url, last_verified, titles(title), platforms(name)'
    )
    .eq('confidence', 'medium')
    .eq('source', 'contributor')
    .order('last_verified', { ascending: true })
    .limit(100)

  const pending: PendingRow[] = (rows ?? []).map((r) => {
    const title = (r as { titles?: { title?: string } | { title?: string }[] }).titles
    const platform = (r as { platforms?: { name?: string } | { name?: string }[] }).platforms
    return {
      id: r.id as string,
      title: (Array.isArray(title) ? title[0]?.title : title?.title) ?? 'Unknown title',
      platform:
        (Array.isArray(platform) ? platform[0]?.name : platform?.name) ?? 'Unknown platform',
      region_code: r.region_code as string,
      available: r.available as boolean,
      watch_url: (r.watch_url as string) ?? null,
    }
  })

  return (
    <div className="max-w-[720px]">
      <h1
        className="text-[22px] font-bold text-[#171717]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Pending approval
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1 mb-6">
        Contributor writes awaiting reviewer confirmation ({pending.length}).
      </p>
      <PendingList rows={pending} />
    </div>
  )
}
