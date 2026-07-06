import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { sortQueueFlags } from '@/lib/admin/queue-sort'
import { QueueList, type QueueFlag, type QueuePlatform } from '@/components/admin/queue-list'

export const dynamic = 'force-dynamic'

export default async function QueuePage() {
  await requireRole(['contributor', 'reviewer', 'admin'])
  const supabase = createAdminClient()

  const [{ data: flags }, { data: platforms }] = await Promise.all([
    supabase
      .from('flags')
      .select(
        'id, title_id, region_code, issue_type, reported_platform, reported_watch_url, notes, created_at, titles(title)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100),
    supabase.from('platforms').select('id, name, slug, supported_regions'),
  ])

  const queueFlags: QueueFlag[] = sortQueueFlags(
    (flags ?? []).map((f) => {
      const rawTitle = (f as { titles?: { title?: string } | { title?: string }[] }).titles
      const titleName = Array.isArray(rawTitle) ? rawTitle[0]?.title : rawTitle?.title
      return {
        id: f.id as string,
        title_id: (f.title_id as string) ?? null,
        title: titleName ?? 'Unknown title',
        region_code: (f.region_code as string) ?? null,
        issue_type: (f.issue_type as string) ?? null,
        reported_platform: (f.reported_platform as string) ?? null,
        reported_watch_url: (f.reported_watch_url as string) ?? null,
        notes: (f.notes as string) ?? null,
        created_at: f.created_at as string,
      }
    })
  )

  return (
    <div className="max-w-[860px]">
      <h1
        className="text-[22px] font-bold text-[#171717]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Review queue
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1 mb-6">
        {queueFlags.length} pending report{queueFlags.length === 1 ? '' : 's'} — known-risk
        (Disney+ PH) first, then oldest.
      </p>
      <QueueList flags={queueFlags} platforms={(platforms ?? []) as QueuePlatform[]} />
    </div>
  )
}
