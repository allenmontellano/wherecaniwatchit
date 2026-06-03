'use client'

import { useState } from 'react'
import { ExternalLink, Tv2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { platformLabel } from '@/lib/platforms'
import { groupByRegion } from '@/lib/title-utils'
import type { AvailabilityWithPlatform } from '@/types/database'

const REGIONS = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
] as const

type RegionCode = (typeof REGIONS)[number]['code']

interface AvailabilityTabsProps {
  availability: AvailabilityWithPlatform[]
  initialCountry: string
}

export function AvailabilityTabs({ availability, initialCountry }: AvailabilityTabsProps) {
  const validInitial = REGIONS.some((r) => r.code === initialCountry)
    ? (initialCountry as RegionCode)
    : 'PH'
  const [active, setActive] = useState<RegionCode>(validInitial)

  const byRegion = groupByRegion(availability)
  const platforms = byRegion[active] ?? []

  return (
    <div>
      <h2
        className="text-lg font-semibold text-[#171717] mb-4"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Where to Watch
      </h2>

      {/* Region tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {REGIONS.map((region) => {
          const hasPlatforms = (byRegion[region.code]?.length ?? 0) > 0
          return (
            <button
              key={region.code}
              type="button"
              onClick={() => setActive(region.code)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-1',
                active === region.code
                  ? 'bg-[#2B72E8] text-white shadow-[0_2px_8px_rgba(43,114,232,0.30)]'
                  : hasPlatforms
                  ? 'bg-white border border-[#E5E5E5] text-[#171717] hover:border-[#2B72E8] hover:text-[#2B72E8]'
                  : 'bg-white border border-[#E5E5E5] text-[#AEAEB8] cursor-default'
              )}
              aria-pressed={active === region.code}
              aria-label={`Show availability in ${region.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/24x18/${region.code.toLowerCase()}.png`}
                alt={region.name}
                width={16}
                height={12}
                className="rounded-[2px] object-cover flex-shrink-0"
              />
              <span>{region.code}</span>
              {hasPlatforms && active !== region.code && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#34C759] flex-shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Platform list */}
      {platforms.length === 0 ? (
        <div
          className="flex items-center gap-3 px-4 py-4 rounded-2xl"
          style={{
            background: 'rgba(245,245,247,0.8)',
            border: '1px solid rgba(229,229,229,0.6)',
          }}
        >
          <Tv2 className="w-5 h-5 text-[#AEAEB8] flex-shrink-0" />
          <p className="text-sm text-[#717177]">
            Not available in{' '}
            <span className="font-medium text-[#171717]">
              {REGIONS.find((r) => r.code === active)?.name}
            </span>{' '}
            on any supported platform.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {platforms.map((a) => {
            const badge = platformLabel(a.platform.slug)
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(229,229,229,0.7)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                  <span className="text-sm text-[#717177] truncate">
                    {a.platform.name}
                  </span>
                </div>
                {a.watch_url && (
                  <a
                    href={a.watch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2B72E8] hover:bg-[#1d5fd1] text-white text-xs font-semibold transition-all duration-150 hover:shadow-[0_4px_14px_rgba(43,114,232,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B72E8] focus-visible:ring-offset-2"
                    aria-label={`Watch on ${a.platform.name} (opens in new tab)`}
                  >
                    Watch
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
