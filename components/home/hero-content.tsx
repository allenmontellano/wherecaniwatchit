'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { SearchForm } from './search-form'

interface HeroContentProps {
  initialCountry: 'PH' | 'US' | 'GB' | 'AU' | 'CA'
}

function fadeUp(index: number, reduced: boolean) {
  return {
    initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: reduced ? 0 : index * 0.12,
      duration: 0.55,
      ease: 'easeOut' as const,
    },
  }
}

export function HeroContent({ initialCountry }: HeroContentProps) {
  const reduced = useReducedMotion() ?? false

  return (
    <div className="flex flex-col items-center gap-7 w-full">
      {/* Logo */}
      <motion.div
        {...fadeUp(0, reduced)}
        className="flex items-center justify-center"
        style={{
          filter:
            'drop-shadow(0 4px 20px rgba(43,114,232,0.14)) drop-shadow(0 1px 3px rgba(0,0,0,0.07))',
        }}
      >
        <Image
          src="/logo.png"
          alt="Where Can I Watch It"
          width={520}
          height={120}
          priority
          className="w-auto h-auto max-w-[min(520px,88vw)]"
          style={{ objectFit: 'contain' }}
        />
      </motion.div>

      {/* Tagline */}
      <motion.p
        {...fadeUp(1, reduced)}
        className="text-[#717177] text-[15px] sm:text-base text-center leading-relaxed max-w-[480px]"
      >
        Find out where any movie or show is streaming&nbsp;—&nbsp;anywhere in the world.
      </motion.p>

      {/* Search form, chips, trust line */}
      <SearchForm initialCountry={initialCountry} reduced={reduced} />
    </div>
  )
}
