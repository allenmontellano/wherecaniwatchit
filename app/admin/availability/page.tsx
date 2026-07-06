import Link from 'next/link'
import { requireRole } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function AvailabilitySearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireRole(['contributor', 'reviewer', 'admin'])
  const { q } = await searchParams
  const query = (q ?? '').trim()

  let titles: { id: string; title: string; type: string; release_year: number | null }[] = []
  if (query.length >= 2) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('titles')
      .select('id, title, type, release_year')
      .ilike('title', `%${query}%`)
      .order('title')
      .limit(25)
    titles = data ?? []
  }

  return (
    <div className="max-w-[720px]">
      <h1
        className="text-[22px] font-bold text-[#171717]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Availability editor
      </h1>
      <p className="text-[13.5px] text-[#717177] mt-1 mb-5">
        Find a title, then edit its availability across regions and platforms.
      </p>

      <form method="get" className="flex gap-2.5 mb-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search titles…"
          className="flex-1 rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer"
        >
          Search
        </button>
      </form>

      {query.length >= 2 && (
        <ul className="flex flex-col gap-2">
          {titles.length === 0 && (
            <li className="text-[14px] text-[#717177]">No titles match &ldquo;{query}&rdquo;.</li>
          )}
          {titles.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/availability/${t.id}`}
                className="flex items-center justify-between rounded-[14px] border border-[#E5E5E5] px-4 py-3 hover:border-[#2B72E8] transition-all"
              >
                <span className="text-[14.5px] font-medium text-[#171717]">{t.title}</span>
                <span className="font-mono text-[10.5px] uppercase text-[#717177]">
                  {t.type} · {t.release_year ?? '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
