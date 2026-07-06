import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { overrideWarning } from '@/lib/admin/title-overrides'
import { TitleEditor, type EditableTitle } from '@/components/admin/title-editor'

export const dynamic = 'force-dynamic'

export default async function TitleEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin')
  const { id } = await params
  const supabase = createAdminClient()

  const { data: title } = await supabase
    .from('titles')
    .select(
      'id, tmdb_id, title, type, status, release_year, synopsis, poster_url, network, content_rating, genres, metadata_overrides'
    )
    .eq('id', id)
    .single()

  if (!title) notFound()

  const warning = overrideWarning(title.status as string | null, title.tmdb_id != null)

  return (
    <div className="max-w-[720px]">
      <Link
        href="/admin/titles"
        className="text-[12.5px] text-[#717177] hover:text-[#171717] transition-colors"
      >
        ← Back to titles
      </Link>
      <h1
        className="text-[22px] font-bold text-[#171717] mt-2"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title.title}
      </h1>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#717177] mt-1 mb-5">
        {title.type} · {title.tmdb_id != null ? `TMDB ${title.tmdb_id}` : 'local title'} ·{' '}
        {(title.status as string) ?? 'unknown status'}
      </p>

      {warning === 'stable' && (
        <div className="rounded-[12px] bg-black/[0.04] px-4 py-3 text-[13px] text-[#171717] mb-5">
          This title has ended/been released. TMDB metadata is unlikely to change — your edits
          will persist through re-syncs.
        </div>
      )}
      {warning === 'airing' && (
        <div className="rounded-[12px] bg-[#FF3B30]/[0.07] px-4 py-3 text-[13px] text-[#171717] mb-5">
          This title is currently airing. TMDB may update this metadata on the next re-sync;
          overridden fields are protected, but only override to correct a persistent TMDB error.
        </div>
      )}

      <TitleEditor title={title as EditableTitle} />
    </div>
  )
}
