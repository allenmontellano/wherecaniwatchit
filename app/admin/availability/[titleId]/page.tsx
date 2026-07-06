import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AvailabilityGrid,
  type GridPlatform,
  type GridRow,
} from '@/components/admin/availability-grid'

export const dynamic = 'force-dynamic'

export default async function TitleAvailabilityPage({
  params,
}: {
  params: Promise<{ titleId: string }>
}) {
  await requireRole(['contributor', 'reviewer', 'admin'])
  const { titleId } = await params
  const supabase = createAdminClient()

  const [{ data: title }, { data: rows }, { data: platforms }, { data: regions }] =
    await Promise.all([
      supabase.from('titles').select('id, title, type, release_year').eq('id', titleId).single(),
      supabase
        .from('availability')
        .select('id, platform_id, region_code, available, watch_url, source, confidence, last_verified')
        .eq('title_id', titleId),
      supabase.from('platforms').select('id, name, slug, supported_regions'),
      supabase.from('regions').select('country_code, country_name').order('display_order'),
    ])

  if (!title) notFound()

  return (
    <div className="max-w-[860px]">
      <Link
        href="/admin/availability"
        className="text-[12.5px] text-[#717177] hover:text-[#171717] transition-colors"
      >
        ← Back to search
      </Link>
      <h1
        className="text-[22px] font-bold text-[#171717] mt-2"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title.title}
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1 mb-6 uppercase font-mono text-[11px] tracking-[0.08em]">
        {title.type} · {title.release_year ?? '—'}
      </p>
      <AvailabilityGrid
        titleId={titleId}
        rows={(rows ?? []) as GridRow[]}
        platforms={(platforms ?? []) as GridPlatform[]}
        regions={regions ?? []}
      />
    </div>
  )
}
