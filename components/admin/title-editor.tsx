'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveTitleOverrides, resetTitleOverride, resyncTitle } from '@/app/admin/titles/actions'

export interface EditableTitle {
  id: string
  tmdb_id: number | null
  title: string
  release_year: number | null
  synopsis: string | null
  poster_url: string | null
  network: string | null
  content_rating: string | null
  genres: string[]
  metadata_overrides: Record<string, unknown>
}

interface FieldDef {
  key: keyof EditableTitle & string
  label: string
  kind: 'text' | 'number' | 'textarea' | 'csv'
}

const FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'release_year', label: 'Release year', kind: 'number' },
  { key: 'synopsis', label: 'Synopsis', kind: 'textarea' },
  { key: 'poster_url', label: 'Poster URL', kind: 'text' },
  { key: 'network', label: 'Network', kind: 'text' },
  { key: 'content_rating', label: 'Content rating', kind: 'text' },
  { key: 'genres', label: 'Genres (comma-separated)', kind: 'csv' },
]

const inputCls =
  'w-full rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[14px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all'

function toDisplay(value: unknown, kind: FieldDef['kind']): string {
  if (value == null) return ''
  if (kind === 'csv' && Array.isArray(value)) return value.join(', ')
  return String(value)
}

function toValue(raw: string, kind: FieldDef['kind']): unknown {
  const trimmed = raw.trim()
  if (kind === 'number') return trimmed ? parseInt(trimmed, 10) : null
  if (kind === 'csv')
    return trimmed
      ? trimmed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  return trimmed || null
}

export function TitleEditor({ title }: { title: EditableTitle }) {
  const router = useRouter()
  const isLocal = title.tmdb_id == null
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, toDisplay(title[f.key], f.kind)]))
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const overriddenKeys = new Set(Object.keys(title.metadata_overrides ?? {}))

  function save() {
    setError(null)
    setNotice(null)
    const changes: Record<string, unknown> = {}
    for (const f of FIELDS) {
      const current = toDisplay(title[f.key], f.kind)
      if (values[f.key] !== current) changes[f.key] = toValue(values[f.key], f.kind)
    }
    if (Object.keys(changes).length === 0) {
      setNotice('No changes to save.')
      return
    }
    startTransition(async () => {
      const res = await saveTitleOverrides(title.id, changes)
      if (res.ok) {
        setNotice(isLocal ? 'Saved.' : 'Saved — these fields are now override-protected.')
        router.refresh()
      } else setError(res.error)
    })
  }

  function reset(key: string) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await resetTitleOverride(title.id, key)
      if (res.ok) {
        setNotice(`Override on "${key}" removed — next re-sync restores the TMDB value.`)
        router.refresh()
      } else setError(res.error)
    })
  }

  function resync() {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await resyncTitle(title.id)
      if (res.ok) {
        setNotice('Re-synced from TMDB (overridden fields preserved).')
        router.refresh()
      } else setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8]">
              {f.label}
            </label>
            {overriddenKeys.has(f.key) && (
              <>
                <span className="font-mono text-[9.5px] tracking-[0.08em] uppercase text-[#34C759] bg-[#34C759]/[0.1] rounded-md px-1.5 py-0.5">
                  overridden
                </span>
                {!isLocal && (
                  <button
                    type="button"
                    onClick={() => reset(f.key)}
                    disabled={pending}
                    className="text-[11px] text-[#717177] hover:text-[#FF3B30] transition-colors cursor-pointer"
                  >
                    reset to TMDB
                  </button>
                )}
              </>
            )}
          </div>
          {f.kind === 'textarea' ? (
            <textarea
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={`${inputCls} resize-none min-h-[90px]`}
            />
          ) : (
            <input
              type="text"
              inputMode={f.kind === 'number' ? 'numeric' : undefined}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={inputCls}
            />
          )}
        </div>
      ))}

      {error && (
        <p className="text-[13px] text-[#FF3B30]" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="text-[13px] text-[#34C759]">{notice}</p>}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Save changes'}
        </button>
        {!isLocal && (
          <button
            type="button"
            onClick={resync}
            disabled={pending}
            className="px-5 py-2.5 rounded-[11px] text-[14px] font-semibold text-[#717177] bg-black/[0.04] hover:bg-black/[0.08] hover:text-[#171717] transition-all cursor-pointer disabled:opacity-60"
          >
            Re-sync from TMDB
          </button>
        )}
      </div>
    </div>
  )
}
