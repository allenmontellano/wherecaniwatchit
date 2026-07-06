'use client'

import { useState, useTransition } from 'react'
import { acceptFlag, rejectFlag } from '@/app/admin/queue/actions'

export interface QueueFlag {
  id: string
  title_id: string | null
  title: string
  region_code: string | null
  issue_type: string | null
  reported_platform: string | null
  reported_watch_url: string | null
  notes: string | null
  created_at: string
}

export interface QueuePlatform {
  id: string
  name: string
  slug: string
  supported_regions: string[]
}

const ISSUE_LABELS: Record<string, string> = {
  'not-here': 'Not available here',
  'is-here': 'IS available here',
  'wrong-platform': 'Wrong platform',
  'wrong-season': 'Wrong season info',
  other: 'Other',
}

const inputCls =
  'w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all'

export function QueueList({ flags, platforms }: { flags: QueueFlag[]; platforms: QueuePlatform[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [handled, setHandled] = useState<Set<string>>(new Set())

  const visible = flags.filter((f) => !handled.has(f.id))
  if (visible.length === 0) {
    return (
      <div className="rounded-[16px] border border-[#E5E5E5] px-6 py-10 text-center text-[14px] text-[#717177]">
        Queue is clear — no pending reports.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {visible.map((flag) => (
        <QueueRow
          key={flag.id}
          flag={flag}
          platforms={platforms.filter(
            (p) => !flag.region_code || p.supported_regions.includes(flag.region_code)
          )}
          open={openId === flag.id}
          onToggle={() => setOpenId(openId === flag.id ? null : flag.id)}
          onHandled={() => {
            setHandled((prev) => new Set(prev).add(flag.id))
            setOpenId(null)
          }}
        />
      ))}
    </ul>
  )
}

function QueueRow({
  flag,
  platforms,
  open,
  onToggle,
  onHandled,
}: {
  flag: QueueFlag
  platforms: QueuePlatform[]
  open: boolean
  onToggle: () => void
  onHandled: () => void
}) {
  const knownSlug = platforms.find((p) => p.slug === flag.reported_platform)
  const [platformId, setPlatformId] = useState(knownSlug?.id ?? '')
  const [watchUrl, setWatchUrl] = useState(flag.reported_watch_url ?? '')
  const [available, setAvailable] = useState(flag.issue_type !== 'not-here')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submitted = new Date(flag.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const isRisk = flag.region_code === 'PH' && flag.reported_platform === 'disney'

  function submitAccept() {
    setError(null)
    if (!flag.title_id || !flag.region_code) {
      setError('This report is missing its title or region and cannot be applied.')
      return
    }
    if (!platformId) {
      setError('Pick the platform this applies to.')
      return
    }
    startTransition(async () => {
      const res = await acceptFlag({
        flagId: flag.id,
        titleId: flag.title_id as string,
        platformId,
        regionCode: flag.region_code as string,
        available,
        watchUrl: watchUrl || undefined,
      })
      if (res.ok) onHandled()
      else setError(res.error)
    })
  }

  function submitReject() {
    setError(null)
    startTransition(async () => {
      const res = await rejectFlag(flag.id)
      if (res.ok) onHandled()
      else setError(res.error)
    })
  }

  return (
    <li className="rounded-[16px] border border-[#E5E5E5] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14.5px] font-semibold text-[#171717] truncate">
              {flag.title}
            </span>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[#717177] bg-black/[0.04] rounded-md px-1.5 py-0.5">
              {flag.region_code ?? '??'}
            </span>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[#2B72E8] bg-[#2B72E8]/[0.08] rounded-md px-1.5 py-0.5">
              {ISSUE_LABELS[flag.issue_type ?? ''] ?? flag.issue_type ?? 'unknown'}
            </span>
            {isRisk && (
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-[#FF3B30] bg-[#FF3B30]/[0.08] rounded-md px-1.5 py-0.5">
                known-risk
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-[#717177] mt-1 truncate">
            {flag.reported_platform ? (
              <>
                Platform:{' '}
                <span className={knownSlug ? '' : 'italic'}>
                  {knownSlug ? knownSlug.name : `"${flag.reported_platform}" (other)`}
                </span>
                {' · '}
              </>
            ) : null}
            {flag.reported_watch_url ? <>{flag.reported_watch_url} · </> : null}
            {submitted}
          </p>
          {flag.notes && <p className="text-[12.5px] text-[#171717] mt-1">{flag.notes}</p>}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="px-4 py-2 rounded-[11px] text-[13px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer"
        >
          {open ? 'Close' : 'Review'}
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-[#E5E5E5] flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8] mb-1.5">
                Platform
              </label>
              <select
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                className={`${inputCls} appearance-none cursor-pointer`}
              >
                <option value="">Select a platform…</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {flag.reported_platform && !knownSlug && (
                <p className="text-[11.5px] text-[#717177] mt-1">
                  Reporter wrote: &ldquo;{flag.reported_platform}&rdquo;
                </p>
              )}
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8] mb-1.5">
                Watch URL (optional)
              </label>
              <input
                type="url"
                value={watchUrl}
                onChange={(e) => setWatchUrl(e.target.value)}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13.5px] text-[#171717] cursor-pointer">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="w-4 h-4 accent-[#2B72E8]"
            />
            Title is available on this platform in {flag.region_code ?? 'this region'}
          </label>

          {error && (
            <p className="text-[13px] text-[#FF3B30]" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={submitAccept}
              disabled={pending}
              className="px-4 py-2 rounded-[11px] text-[13px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Confirm & apply'}
            </button>
            <button
              type="button"
              onClick={submitReject}
              disabled={pending}
              className="px-4 py-2 rounded-[11px] text-[13px] font-semibold text-[#FF3B30] bg-[#FF3B30]/[0.08] hover:bg-[#FF3B30]/[0.14] transition-all cursor-pointer disabled:opacity-60"
            >
              Reject report
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
