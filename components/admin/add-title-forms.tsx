'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addTitleByTmdbId, addLocalTitle } from '@/app/admin/titles/actions'
import type { TitleType } from '@/types/database'

const inputCls =
  'rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[13.5px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all'

export function AddTitleForms() {
  const router = useRouter()
  const [tmdbId, setTmdbId] = useState('')
  const [tmdbType, setTmdbType] = useState<TitleType>('movie')
  const [localName, setLocalName] = useState('')
  const [localType, setLocalType] = useState<TitleType>('movie')
  const [localYear, setLocalYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submitTmdb() {
    setError(null)
    setNotice(null)
    const id = parseInt(tmdbId, 10)
    if (!Number.isInteger(id) || id <= 0) {
      setError('Enter a valid TMDB id.')
      return
    }
    startTransition(async () => {
      const res = await addTitleByTmdbId(id, tmdbType)
      if (res.ok && res.titleId) {
        router.push(`/admin/titles/${res.titleId}`)
      } else if (!res.ok) setError(res.error)
    })
  }

  function submitLocal() {
    setError(null)
    setNotice(null)
    if (!localName.trim()) {
      setError('A title name is required.')
      return
    }
    startTransition(async () => {
      const res = await addLocalTitle({
        title: localName.trim(),
        type: localType,
        release_year: localYear ? parseInt(localYear, 10) : null,
      })
      if (res.ok && res.titleId) {
        setLocalName('')
        setLocalYear('')
        setNotice('Local title created.')
        router.push(`/admin/titles/${res.titleId}`)
      } else if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="rounded-[16px] border border-[#E5E5E5] px-5 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8] w-[90px]">
          From TMDB
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={tmdbId}
          onChange={(e) => setTmdbId(e.target.value)}
          placeholder="TMDB id"
          className={`${inputCls} w-[120px]`}
        />
        <select
          value={tmdbType}
          onChange={(e) => setTmdbType(e.target.value as TitleType)}
          className={`${inputCls} appearance-none cursor-pointer`}
        >
          <option value="movie">Movie</option>
          <option value="tv">TV</option>
        </select>
        <button
          type="button"
          onClick={submitTmdb}
          disabled={pending}
          className="px-4 py-2 rounded-[10px] text-[12.5px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Add & seed'}
        </button>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap pt-3 border-t border-[#E5E5E5]">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8] w-[90px]">
          Local title
        </span>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          placeholder="Title name (no TMDB entry)"
          className={`${inputCls} flex-1 min-w-[180px]`}
        />
        <select
          value={localType}
          onChange={(e) => setLocalType(e.target.value as TitleType)}
          className={`${inputCls} appearance-none cursor-pointer`}
        >
          <option value="movie">Movie</option>
          <option value="tv">TV</option>
        </select>
        <input
          type="text"
          inputMode="numeric"
          value={localYear}
          onChange={(e) => setLocalYear(e.target.value)}
          placeholder="Year"
          className={`${inputCls} w-[80px]`}
        />
        <button
          type="button"
          onClick={submitLocal}
          disabled={pending}
          className="px-4 py-2 rounded-[10px] text-[12.5px] font-semibold text-[#2B72E8] bg-[#2B72E8]/[0.08] hover:bg-[#2B72E8]/[0.14] transition-all cursor-pointer disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Create'}
        </button>
      </div>

      {error && (
        <p className="text-[12.5px] text-[#FF3B30]" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="text-[12.5px] text-[#34C759]">{notice}</p>}
    </div>
  )
}
