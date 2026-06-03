export interface PlatformBadge {
  label: string
  bg: string
  text: string
}

const KNOWN: Record<string, PlatformBadge> = {
  netflix:           { label: 'Netflix',      bg: '#FEE2E2', text: '#991B1B' },
  prime:             { label: 'Prime Video',  bg: '#DBEAFE', text: '#1E40AF' },
  'disney-plus':     { label: 'Disney+',      bg: '#EDE9FE', text: '#5B21B6' },
  hbo:               { label: 'HBO Max',      bg: '#F3E8FF', text: '#7E22CE' },
  'apple-tv-plus':   { label: 'Apple TV+',   bg: '#F1F5F9', text: '#334155' },
  hulu:              { label: 'Hulu',         bg: '#DCFCE7', text: '#15803D' },
  peacock:           { label: 'Peacock',      bg: '#FEF9C3', text: '#854D0E' },
  'paramount-plus':  { label: 'Paramount+',  bg: '#DBEAFE', text: '#1E40AF' },
  mubi:              { label: 'MUBI',         bg: '#FFF7ED', text: '#9A3412' },
  showtime:          { label: 'Showtime',     bg: '#FEF2F2', text: '#7F1D1D' },
}

export function platformLabel(slug: string): PlatformBadge {
  if (KNOWN[slug]) return KNOWN[slug]
  const label = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { label, bg: '#F1F5F9', text: '#475569' }
}
