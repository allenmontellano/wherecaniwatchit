'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Star, Flag } from 'lucide-react'
import type { Title } from '@/types/database'
import { REGIONS, regionByCode } from '@/lib/country'
import { useCountry } from '@/components/country/country-context'
import { formatExtent } from '@/lib/title-utils'
import { posterGradient } from '@/lib/poster'
import { PlatformBadge } from '@/components/ui/platform-badge'
import { AnswerBox } from '@/components/ui/answer-box'

interface ResultCardProps {
  title: Title
  availabilityByRegion: Record<string, string[]>
  index: number
  onReport: (title: Title) => void
}

export function ResultCard({ title, availabilityByRegion, index, onReport }: ResultCardProps) {
  const { country } = useCountry()
  const reduced = useReducedMotion()
  const region = regionByCode[country]
  const here = availabilityByRegion[country] ?? []
  const available = here.length > 0

  const metaBits = [
    title.network,
    title.release_year,
    title.type === 'tv' ? 'Series' : 'Movie',
    title.genres[0],
    formatExtent(title),
  ].filter(Boolean) as (string | number)[]

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: 'easeOut' }}
      whileHover={reduced ? undefined : { y: -3 }}
      className="flex flex-col min-[721px]:flex-row gap-5 min-[721px]:gap-7 p-5 min-[721px]:p-7 bg-white rounded-[22px] transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(43,114,232,0.10),0_4px_12px_rgba(0,0,0,0.06)]"
      style={{
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Poster */}
      <Link
        href={`/titles/${title.id}?country=${country}`}
        className="flex-shrink-0 self-start"
        aria-label={`View ${title.title}`}
      >
        <div
          className="relative w-[120px] min-[721px]:w-[156px] rounded-[14px] overflow-hidden flex flex-col items-center justify-center text-center"
          style={{
            aspectRatio: '2 / 3',
            background: title.poster_url ? '#F5F5F7' : posterGradient(title.id),
            boxShadow: '0 10px 28px rgba(0,0,0,0.14), inset 0 0 0 1px rgba(0,0,0,0.04)',
          }}
        >
          {title.poster_url ? (
            <Image
              src={title.poster_url}
              alt={title.title}
              fill
              className="object-cover"
              sizes="156px"
            />
          ) : (
            <div className="px-3 py-4">
              <span
                className="block text-[16px] leading-tight text-[rgba(23,23,23,0.78)]"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600, textWrap: 'balance' }}
              >
                {title.title}
              </span>
              <span className="block mt-2.5 font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(23,23,23,0.32)]">
                Poster
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Link href={`/titles/${title.id}?country=${country}`} className="group">
          <h2
            className="text-[25px] font-bold text-[#171717] leading-[1.12] mb-2 group-hover:text-[#2B72E8] transition-colors"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
          >
            {title.title}
          </h2>
        </Link>

        <div className="flex flex-wrap items-center gap-2 mb-2.5 text-[13px] text-[#717177]">
          {metaBits.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-[#AEAEB8]">·</span>}
              <span>{b}</span>
            </span>
          ))}
          {title.imdb_rating != null && (
            <>
              <span className="text-[#AEAEB8]">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#171717]">
                <Star className="w-3.5 h-3.5 fill-[#F5C518] stroke-none" />
                {title.imdb_rating.toFixed(1)}
              </span>
            </>
          )}
        </div>

        {title.synopsis && (
          <p
            className="text-[14px] text-[#717177] leading-[1.55] mb-[18px] max-w-[56ch]"
            style={{ textWrap: 'pretty' }}
          >
            {title.synopsis}
          </p>
        )}

        {/* Dominant answer */}
        <div className="mb-[18px]">
          <AnswerBox available={available} region={region}>
            {available ? (
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                {here.map((slug) => (
                  <PlatformBadge key={slug} slug={slug} size="lg" />
                ))}
              </div>
            ) : (
              <div className="mt-1.5">
                <span className="text-[13px] text-[#717177]">
                  Not currently streaming on any service here.
                </span>
              </div>
            )}
          </AnswerBox>
        </div>

        {/* Other regions */}
        <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-[#AEAEB8] mb-1.5">
          Available in other regions
        </div>
        {REGIONS.filter((r) => r.code !== country).map((r) => {
          const av = availabilityByRegion[r.code] ?? []
          return (
            <div
              key={r.code}
              className="flex items-center justify-between gap-3 py-2.5 px-0.5 border-t border-black/[0.06]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://flagcdn.com/24x18/${r.flag}.png`}
                  alt={r.name}
                  width={22}
                  height={16}
                  className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
                />
                <span className="text-[14px] font-medium text-[#171717]">{r.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                {av.length > 0 ? (
                  av.map((slug) => <PlatformBadge key={slug} slug={slug} />)
                ) : (
                  <span className="text-[13px] text-[#AEAEB8]">Not available</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Report */}
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => onReport(title)}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[#AEAEB8] hover:text-[#2B72E8] transition-colors cursor-pointer"
          >
            <Flag className="w-[13px] h-[13px]" />
            <span>Report incorrect info</span>
          </button>
        </div>
      </div>
    </motion.article>
  )
}
