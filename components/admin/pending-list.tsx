'use client'

import { useState, useTransition } from 'react'
import { confirmAvailability } from '@/app/admin/availability/actions'

export interface PendingRow {
  id: string
  title: string
  platform: string
  region_code: string
  available: boolean
  watch_url: string | null
}

export function PendingList({ rows }: { rows: PendingRow[] }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const visible = rows.filter((r) => !done.has(r.id))

  if (visible.length === 0) {
    return (
      <div className="rounded-[16px] border border-[#E5E5E5] px-6 py-10 text-center text-[14px] text-[#717177]">
        Nothing awaiting approval.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {visible.map((row) => (
        <PendingItem key={row.id} row={row} onDone={() => setDone((s) => new Set(s).add(row.id))} />
      ))}
    </ul>
  )
}

function PendingItem({ row, onDone }: { row: PendingRow; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await confirmAvailability(row.id)
      if (res.ok) onDone()
      else setError(res.error)
    })
  }

  return (
    <li className="rounded-[14px] border border-[#E5E5E5] px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-[#171717] truncate">
          {row.title} — {row.platform}{' '}
          <span className="font-mono text-[10px] uppercase text-[#717177]">{row.region_code}</span>
        </p>
        <p className="text-[12px] text-[#717177] truncate">
          {row.available ? 'available' : 'NOT available'}
          {row.watch_url ? ` · ${row.watch_url}` : ''}
        </p>
        {error && (
          <p className="text-[12px] text-[#FF3B30]" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={confirm}
        disabled={pending}
        className="px-4 py-2 rounded-[10px] text-[12.5px] font-semibold text-white bg-[#34C759] hover:brightness-95 transition-all cursor-pointer disabled:opacity-60"
      >
        {pending ? 'Confirming…' : 'Confirm → high'}
      </button>
    </li>
  )
}
