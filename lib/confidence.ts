export type Confidence = 'high' | 'medium' | 'low'

export interface ConfidenceInput {
  source: string
  platformSlug: string
  regionCode: string
}

interface LowConfidenceRule {
  sources: string[]
  platformSlugs: string[]
  regionCodes: string[]
}

// Known-unreliable aggregator data (SP5 finding). SP11 extends this list.
export const LOW_CONFIDENCE_RULES: LowConfidenceRule[] = [
  { sources: ['api', 'cron'], platformSlugs: ['disney'], regionCodes: ['PH'] },
]

export function computeConfidence({ source, platformSlug, regionCode }: ConfidenceInput): Confidence {
  if (source === 'reviewer') return 'high'
  if (source === 'contributor') return 'medium'
  const low = LOW_CONFIDENCE_RULES.some(
    (r) =>
      r.sources.includes(source) &&
      r.platformSlugs.includes(platformSlug) &&
      r.regionCodes.includes(regionCode)
  )
  return low ? 'low' : 'medium'
}
