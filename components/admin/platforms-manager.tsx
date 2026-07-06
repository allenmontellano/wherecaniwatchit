'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPlatform, updatePlatform } from '@/app/admin/platforms/actions'
import { LAUNCH_REGION_CODES } from '@/lib/admin/platforms-service'

export interface ManagedPlatform {
  id: string
  name: string
  slug: string
  logo_url: string | null
  supported_regions: string[]
}

const inputCls =
  'rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[13.5px] text-[#171717] placeholder:text-[#AEAEB8] focus:outline-none focus:border-[#2B72E8] focus:shadow-[0_0_0_3px_rgba(43,114,232,0.12)] transition-all'

function RegionPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (regions: string[]) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {LAUNCH_REGION_CODES.map((code) => {
        const active = value.includes(code)
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(active ? value.filter((r) => r !== code) : [...value, code])}
            className={`font-mono text-[10.5px] tracking-[0.06em] uppercase rounded-md px-2 py-1 transition-all cursor-pointer ${
              active
                ? 'text-[#2B72E8] bg-[#2B72E8]/[0.1]'
                : 'text-[#AEAEB8] bg-black/[0.04] hover:text-[#717177]'
            }`}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}

export function PlatformsManager({ platforms }: { platforms: ManagedPlatform[] }) {
  return (
    <div className="flex flex-col gap-3">
      <CreateForm />
      <ul className="flex flex-col gap-2.5">
        {platforms.map((p) => (
          <PlatformRow key={p.id} platform={p} />
        ))}
      </ul>
    </div>
  )
}

function CreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createPlatform({ name, slug, regions })
      if (res.ok) {
        setName('')
        setSlug('')
        setRegions([])
        router.refresh()
      } else setError(res.error)
    })
  }

  return (
    <div className="rounded-[16px] border border-[#E5E5E5] px-5 py-4 flex flex-col gap-3">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#AEAEB8]">
        New platform
      </span>
      <div className="flex items-center gap-2.5 flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Vivamax)"
          className={`${inputCls} flex-1 min-w-[140px]`}
        />
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="slug (permanent)"
          className={`${inputCls} w-[150px] font-mono`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="px-4 py-2 rounded-[10px] text-[12.5px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create'}
        </button>
      </div>
      <RegionPicker value={regions} onChange={setRegions} />
      {error && (
        <p className="text-[12.5px] text-[#FF3B30]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function PlatformRow({ platform }: { platform: ManagedPlatform }) {
  const router = useRouter()
  const [name, setName] = useState(platform.name)
  const [regions, setRegions] = useState(platform.supported_regions)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updatePlatform(platform.id, { name, regions })
      if (res.ok) {
        setSaved(true)
        router.refresh()
      } else setError(res.error)
    })
  }

  return (
    <li className="rounded-[14px] border border-[#E5E5E5] px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} w-[180px]`}
        />
        <span className="font-mono text-[10.5px] text-[#AEAEB8]">{platform.slug}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-3.5 py-2 rounded-[10px] text-[12.5px] font-semibold text-white bg-[#2B72E8] hover:bg-[#1d5fd1] transition-all cursor-pointer disabled:opacity-60"
        >
          {pending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      <RegionPicker value={regions} onChange={setRegions} />
      {error && (
        <p className="text-[12.5px] text-[#FF3B30]" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}
