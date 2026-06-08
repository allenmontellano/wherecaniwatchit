import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  width?: number
}

export function Logo({ className, width = 340 }: LogoProps) {
  // logo.png is a 3:1 horizontal lockup (icon + wordmark).
  const height = Math.round(width / 3)

  return (
    <Image
      src="/logo.png"
      alt="Where Can I Watch It"
      width={width}
      height={height}
      priority
      // Cap display width at `width`, but let it shrink to fit narrow
      // viewports with height:auto so the 3:1 ratio is always preserved.
      className={cn('block h-auto max-w-full select-none', className)}
      style={{ width }}
    />
  )
}
