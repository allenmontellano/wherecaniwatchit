'use client'

import Image from 'next/image'
import { Star, ArrowRight, Globe } from 'lucide-react'
import { REGIONS, regionByCode } from '@/lib/country'
import { useCountry } from '@/components/country/country-context'
import { formatExtent } from '@/lib/title-utils'
import { posterGradient } from '@/lib/poster'
import { PlatformBadge } from '@/components/ui/platform-badge'
import { AnswerBox } from '@/components/ui/answer-box'
import type { SyncedResult } from '@/types/search'

export function NotInRegion({ result }: { result: SyncedResult }) {
  const { title, availabilityByRegion } = result
  const { country, setCountry } = useCountry()
  const region = regionByCode[country]

  const metaBits = [
    title.network,
    title.release_year,
    title.type === 'tv' ? 'Series' : 'Movie',
    title.genres[0],
    formatExtent(title),
  ].filter(Boolean) as (string | number)[]

  const availRegions = REGIONS.filter(
    (r) => r.code !== country && (availabilityByRegion[r.code]?.length ?? 0) > 0
  )

  return (
    <section className="max-w-[640px] mx-auto py-10">
      <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#AEAEB8] mb-[30px] text-center">
        Found · not in your region
      </div>

      {/* Condensed title card */}
      <div
        className="flex gap-[18px] p-[18px] bg-white rounded-[18px]"
        style={{ border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 8px 28px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03)' }}
      >
        <div
          className="relative flex-shrink-0 w-[96px] rounded-[11px] overflow-hidden flex flex-col items-center justify-center text-center"
          style={{
            aspectRatio: '2 / 3',
            background: title.poster_url ? '#F5F5F7' : posterGradient(title.id),
            boxShadow: '0 6px 18px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.04)',
          }}
        >
          {title.poster_url ? (
            <Image src={title.poster_url} alt={title.title} fill className="object-cover" sizes="96px" />
          ) : (
            <div className="px-2 py-2.5">
              <span
                className="block text-[12px] leading-tight text-[rgba(23,23,23,0.78)]"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
              >
                {title.title}
              </span>
              <span className="block mt-1.5 font-mono text-[7.5px] tracking-[0.12em] uppercase text-[rgba(23,23,23,0.32)]">
                Poster
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h2
            className="text-[20px] font-bold text-[#171717] mb-1.5 leading-[1.1]"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
          >
            {title.title}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#717177] mb-2">
            {metaBits.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[#AEAEB8]">·</span>}
                <span>{b}</span>
              </span>
            ))}
            {title.imdb_rating != null && (
              <>
                <span className="text-[#AEAEB8]">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#171717]">
                  <Star className="w-[13px] h-[13px] fill-[#F5C518] stroke-none" />
                  {title.imdb_rating.toFixed(1)}
                </span>
              </>
            )}
          </div>
          {title.synopsis && (
            <p className="text-[13px] text-[#717177] leading-[1.5] m-0" style={{ textWrap: 'pretty' }}>
              {title.synopsis}
            </p>
          )}
        </div>
      </div>

      {/* Answer */}
      <div className="mt-4">
        <AnswerBox available={false} region={region}>
          <p className="text-[13.5px] text-[#717177] mt-1.5">
            Not currently streaming on any service in your region.
          </p>
        </AnswerBox>
      </div>

      {/* Available in these regions */}
      {availRegions.length > 0 && (
        <div className="mt-[30px]">
          <h3 className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#AEAEB8] mb-3.5">
            Available in these regions
          </h3>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
            {availRegions.map((r) => {
              const slug = availabilityByRegion[r.code][0]
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setCountry(r.code)}
                  aria-label={`Switch to ${r.name}`}
                  className="group flex flex-col gap-2.5 p-4 bg-white rounded-[16px] border border-[#E5E5E5] cursor-pointer text-left transition-all duration-150 hover:border-[#2B72E8] hover:-translate-y-[3px] hover:shadow-[0_12px_30px_rgba(43,114,232,0.12),0_2px_8px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:border-[#2B72E8] focus-visible:shadow-[0_0_0_3px_rgba(43,114,232,0.14)]"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
                >
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://flagcdn.com/24x18/${r.flag}.png`}
                      alt=""
                      width={26}
                      height={19}
                      className="rounded-[3px] object-cover flex-shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
                    />
                    <span className="text-[15px] font-semibold text-[#171717]">{r.name}</span>
                    <ArrowRight className="ml-auto w-4 h-4 text-[#AEAEB8] group-hover:text-[#2B72E8] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <PlatformBadge slug={slug} />
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-center text-[13px] text-[#717177] leading-[1.55] mt-[22px] max-w-[44ch] mx-auto">
            <Globe className="inline w-3.5 h-3.5 align-[-2px] mr-1.5 text-[#AEAEB8]" />
            Switching region shows you what&apos;s available there — your location hasn&apos;t changed.
          </p>
        </div>
      )}
    </section>
  )
}
