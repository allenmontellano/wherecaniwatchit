import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  width?: number
}

export function Logo({ className, width = 340 }: LogoProps) {
  // logo.png is a 3:1 horizontal lockup (icon + wordmark) — 2172×724
  const height = Math.round(width / 3)

  return (
    <Image
      src="/logo.png"
      alt="Where Can I Watch It"
      width={width}
      height={height}
      priority
      className={cn('block h-auto w-auto select-none', className)}
      style={{ width, height }}
    />
  )
}
