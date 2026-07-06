import { describe, it, expect } from 'vitest'
import { sortQueueFlags, type QueueSortable } from '@/lib/admin/queue-sort'

function f(id: string, created: string, region: string | null, platform: string | null): QueueSortable {
  return { id, created_at: created, region_code: region, reported_platform: platform }
}

describe('sortQueueFlags', () => {
  it('sorts oldest first by default', () => {
    const sorted = sortQueueFlags([
      f('b', '2026-07-02T00:00:00Z', 'US', 'netflix'),
      f('a', '2026-07-01T00:00:00Z', 'US', 'netflix'),
    ])
    expect(sorted.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('puts known-risk (Disney+ PH) flags first regardless of age', () => {
    const sorted = sortQueueFlags([
      f('old', '2026-07-01T00:00:00Z', 'US', 'netflix'),
      f('risky', '2026-07-05T00:00:00Z', 'PH', 'disney'),
    ])
    expect(sorted.map((x) => x.id)).toEqual(['risky', 'old'])
  })

  it('orders within the risk group by age', () => {
    const sorted = sortQueueFlags([
      f('r2', '2026-07-05T00:00:00Z', 'PH', 'disney'),
      f('r1', '2026-07-03T00:00:00Z', 'PH', 'disney'),
      f('n1', '2026-07-01T00:00:00Z', 'PH', 'netflix'),
    ])
    expect(sorted.map((x) => x.id)).toEqual(['r1', 'r2', 'n1'])
  })

  it('does not treat Disney outside PH as risky', () => {
    const sorted = sortQueueFlags([
      f('old', '2026-07-01T00:00:00Z', 'US', 'disney'),
      f('new', '2026-07-05T00:00:00Z', 'US', 'disney'),
    ])
    expect(sorted.map((x) => x.id)).toEqual(['old', 'new'])
  })

  it('handles null region/platform', () => {
    const sorted = sortQueueFlags([
      f('x', '2026-07-02T00:00:00Z', null, null),
      f('y', '2026-07-01T00:00:00Z', null, null),
    ])
    expect(sorted.map((s) => s.id)).toEqual(['y', 'x'])
  })
})
