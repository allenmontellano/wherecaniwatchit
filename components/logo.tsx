import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  iconSize?: number
}

export function Logo({ className, iconSize = 72 }: LogoProps) {
  const h = iconSize
  const w = Math.round(iconSize * 1.3)

  return (
    <div className={cn('flex items-center gap-5', className)}>
      {/* Cloud + play icon — pure SVG, no white background box */}
      <svg
        width={w}
        height={h}
        viewBox="0 0 78 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Cloud body: overlapping circles + base rect */}
        <circle cx="39" cy="22" r="20" fill="#2B72E8" />
        <circle cx="60" cy="31" r="14" fill="#2B72E8" />
        <circle cx="19" cy="32" r="12" fill="#2B72E8" />
        <rect x="7" y="32" width="64" height="22" rx="11" fill="#2B72E8" />

        {/* White circle for play button background */}
        <circle cx="39" cy="38" r="14" fill="white" />

        {/* Play triangle */}
        <path d="M35 32 L35 44 L48 38 Z" fill="#2B72E8" />
      </svg>

      {/* Wordmark — two lines, bold display font */}
      <div className="flex flex-col leading-none gap-0.5" style={{ fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)' }}>
        <span className="text-[2rem] font-bold tracking-[-0.025em] text-[#171717] leading-[1.05]">
          Where Can I
        </span>
        <span className="text-[2rem] font-bold tracking-[-0.025em] text-[#171717] leading-[1.05]">
          Watch It
        </span>
      </div>
    </div>
  )
}
