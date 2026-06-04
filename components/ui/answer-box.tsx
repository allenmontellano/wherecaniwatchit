import { Check, X } from 'lucide-react'
import type { RegionMeta } from '@/lib/country'

interface AnswerBoxProps {
  available: boolean
  region: RegionMeta
  size?: 'card' | 'lg'
  children?: React.ReactNode
}

export function AnswerBox({ available, region, size = 'card', children }: AnswerBoxProps) {
  const lg = size === 'lg'
  const iconSize = lg ? 44 : 28
  const glyph = lg ? 24 : 16

  return (
    <div
      className="flex items-start"
      style={{
        borderRadius: lg ? 18 : 14,
        padding: lg ? '26px 28px' : '16px 18px',
        gap: lg ? 18 : 14,
        background: available ? 'rgba(52,199,89,0.07)' : 'rgba(255,59,48,0.045)',
        borderLeft: available
          ? `${lg ? 5 : 4}px solid #34C759`
          : `${lg ? 5 : 4}px solid rgba(255,59,48,0.4)`,
        boxShadow: lg ? '0 8px 30px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)' : undefined,
      }}
    >
      <span
        className="flex-shrink-0 rounded-full flex items-center justify-center"
        style={{
          width: iconSize,
          height: iconSize,
          marginTop: lg ? 0 : 1,
          background: available ? '#34C759' : 'rgba(255,59,48,0.12)',
        }}
      >
        {available ? (
          <Check style={{ width: glyph, height: glyph }} className="text-white" strokeWidth={3} />
        ) : (
          <X style={{ width: glyph, height: glyph }} className="text-[#FF3B30]" strokeWidth={3} />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-2 text-[#171717] leading-tight"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: lg ? 24 : 17,
            letterSpacing: '-0.01em',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/24x18/${region.flag}.png`}
            alt={region.name}
            width={lg ? 30 : 24}
            height={lg ? 22 : 18}
            className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
          />
          <span>
            {available ? 'Available' : 'Not available'} in {region.name}
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
