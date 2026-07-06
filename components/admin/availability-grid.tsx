'use client'

import { useState, useTransition } from 'react'
import { writeAvailability } from '@/app/admin/availability/actions'
import type { AvailabilityConfidence } from '@/types/database'

export interface GridRow {
  id: string
  platform_id: string
  region_code: string
  available: boolean
  watch_url: string | null
  source: string
  confidence: AvailabilityConfidence
  last_verified: string
}

export interface GridPlatform {
  id: string
  name: string
  slug: string
  supported_regions: string[]
}

const CONFIDENCE_STYLE: Record<AvailabilityConfidence, string> = {
  high: 'text-[#34C759] bg-[#34C759]/[0.1]',
  medium: 'text-[#717177] bg-black/[0.05]',
  low: 'text-[#FF3B30] bg-[#FF3B30]/[0.08]',
}

const inputCls =
  'rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[13.5px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all'

export function AvailabilityGrid({
  titleId,
  rows,
  platforms,
  regions,
}: {
  titleId: string
  rows: GridRow[]
  platforms: GridPlatform[]
  regions: { country_code: string; country_name: string }[]
}) {
  return (
    <div className="flex flex-col gap-6">
      {regions.map((region) => (
        <RegionSection
          key={region.country_code}
          titleId={titleId}
          region={region}
          rows={rows.filter((r) => r.region_code === region.country_code)}
          platforms={platforms.filter((p) => p.supported_regions.includes(region.country_code))}
        />
      ))}
    </div>
  )
}

function RegionSection({
  titleId,
  region,
  rows,
  platforms,
}: {
  titleId: string
  region: { country_code: string; country_name: string }
  rows: GridRow[]
  platforms: GridPlatform[]
}) {
  const platformName = (id: string) => platforms.find((p) => p.id === id)?.name ?? 'Unknown'
  const unusedPlatforms = platforms.filter((p) => !rows.some((r) => r.platform_id === p.id))

  return (
    <section className="rounded-[16px] border border-[#E5E5E5] px-5 py-4">
      <h2
        className="text-[15px] font-bold text-[#171717] mb-3"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {region.country_name}{' '}
        <span className="font-mono text-[10px] uppercase text-[#717177]">
          {region.country_code}
        </span>
      </h2>
      {rows.length === 0 && (
        <p className="text-[13px] text-[#717177] mb-3">No availability recorded.</p>
      )}
      <ul className="flex flex-col gap-2 mb-3">
        {rows.map((row) => (
          <ExistingRow key={row.id} titleId={titleId} row={row} name={platformName(row.platform_id)} />
        ))}
      </ul>
      {unusedPlatforms.length > 0 && (
        <AddRow titleId={titleId} regionCode={region.country_code} platforms={unusedPlatforms} />
      )}
    </section>
  )
}

function ExistingRow({ titleId, row, name }: { titleId: string; row: GridRow; name: string }) {
  const [watchUrl, setWatchUrl] = useState(row.watch_url ?? '')
  const [available, setAvailable] = useState(row.available)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await writeAvailability({
        titleId,
        platformId: row.platform_id,
        regionCode: row.region_code,
        available,
        watchUrl: watchUrl || undefined,
      })
      if (res.ok) setSaved(true)
      else setError(res.error)
    })
  }

  return (
    <li className="flex items-center gap-3 flex-wrap">
      <span className="w-[110px] text-[13.5px] font-medium text-[#171717] truncate">{name}</span>
      <span
        className={`font-mono text-[9.5px] tracking-[0.08em] uppercase rounded-md px-1.5 py-0.5 ${CONFIDENCE_STYLE[row.confidence]}`}
      >
        {row.confidence}
      </span>
      <span className="font-mono text-[9.5px] uppercase text-[#AEAEB8]">{row.source}</span>
      <label className="flex items-center gap-1.5 text-[12.5px] text-[#171717] cursor-pointer">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
          className="w-3.5 h-3.5 accent-[#2B72E8]"
        />
        available
      </label>
      <input
        type="url"
        value={watchUrl}
        onChange={(e) => setWatchUrl(e.target.value)}
        placeholder="watch URL"
        className={`${inputCls} flex-1 min-w-[160px]`}
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="px-3.5 py-2 rounded-[10px] text-[12.5px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer disabled:opacity-60"
      >
        {pending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
      {error && (
        <span className="text-[12px] text-[#FF3B30] w-full" role="alert">
          {error}
        </span>
      )}
    </li>
  )
}

function AddRow({
  titleId,
  regionCode,
  platforms,
}: {
  titleId: string
  regionCode: string
  platforms: GridPlatform[]
}) {
  const [platformId, setPlatformId] = useState('')
  const [watchUrl, setWatchUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function add() {
    setError(null)
    if (!platformId) {
      setError('Pick a platform to add.')
      return
    }
    startTransition(async () => {
      const res = await writeAvailability({
        titleId,
        platformId,
        regionCode,
        available: true,
        watchUrl: watchUrl || undefined,
      })
      if (res.ok) {
        setPlatformId('')
        setWatchUrl('')
      } else setError(res.error)
    })
  }

  return (
    <div className="flex items-center gap-2.5 flex-wrap pt-3 border-t border-[#E5E5E5]">
      <select
        value={platformId}
        onChange={(e) => setPlatformId(e.target.value)}
        className={`${inputCls} appearance-none cursor-pointer min-w-[150px]`}
      >
        <option value="">Add platform…</option>
        {platforms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="url"
        value={watchUrl}
        onChange={(e) => setWatchUrl(e.target.value)}
        placeholder="watch URL (optional)"
        className={`${inputCls} flex-1 min-w-[160px]`}
      />
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className="px-3.5 py-2 rounded-[10px] text-[12.5px] font-semibold text-[#2B72E8] bg-[#2B72E8]/[0.08] hover:bg-[#2B72E8]/[0.14] transition-all cursor-pointer disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add'}
      </button>
      {error && (
        <span className="text-[12px] text-[#FF3B30] w-full" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
