import { platformLabel } from '@/lib/platforms'

export function PlatformBadge({ slug, size = 'sm' }: { slug: string; size?: 'sm' | 'lg' }) {
  const p = platformLabel(slug)
  return (
    <span
      className="inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap"
      style={{
        background: p.bg,
        color: p.text,
        padding: size === 'lg' ? '6px 13px' : '4px 11px',
        fontSize: size === 'lg' ? 13 : 12,
      }}
    >
      {p.label}
    </span>
  )
}
