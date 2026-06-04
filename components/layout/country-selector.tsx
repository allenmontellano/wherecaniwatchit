'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REGIONS, regionByCode } from '@/lib/country'
import { useCountry } from '@/components/country/country-context'

export function CountrySelector() {
  const { country, setCountry } = useCountry()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = regionByCode[country]

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div className="relative justify-self-end" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-[#E5E5E5] hover:border-[#2B72E8] hover:bg-[#2B72E8]/[0.03] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${selected.name}. Click to change.`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://flagcdn.com/24x18/${selected.flag}.png`}
          alt={selected.name}
          width={22}
          height={16}
          className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
        />
        <span className="hidden min-[721px]:inline text-[13px] font-medium text-[#171717] whitespace-nowrap">
          {selected.name}
        </span>
        <ChevronDown
          className={cn(
            'w-[13px] h-[13px] text-[#AEAEB8] flex-shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-[60] bg-white rounded-2xl border border-black/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] py-1.5 min-w-[200px] overflow-hidden"
          role="listbox"
          aria-label="Select country"
        >
          {REGIONS.map((r) => (
            <button
              key={r.code}
              type="button"
              role="option"
              aria-selected={r.code === country}
              onClick={() => {
                setCountry(r.code)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors duration-100 text-left',
                r.code === country
                  ? 'text-[#2B72E8] font-medium bg-[#2B72E8]/[0.05]'
                  : 'text-[#171717] hover:bg-[#2B72E8]/[0.05]'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/24x18/${r.flag}.png`}
                alt={r.name}
                width={22}
                height={16}
                className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
              />
              <span>{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
