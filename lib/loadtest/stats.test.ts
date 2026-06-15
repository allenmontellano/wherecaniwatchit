import { describe, it, expect } from 'vitest'
import { percentile, summarize, errorRate, withinThreshold } from './stats'

describe('percentile', () => {
  it('returns 0 for empty input', () => {
    expect(percentile([], 95)).toBe(0)
  })

  it('returns the single value for a one-element array', () => {
    expect(percentile([10], 95)).toBe(10)
  })

  it('computes nearest-rank percentiles for [1..10]', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(values, 50)).toBe(5)
    expect(percentile(values, 90)).toBe(9)
    expect(percentile(values, 95)).toBe(10)
    expect(percentile(values, 99)).toBe(10)
    expect(percentile(values, 100)).toBe(10)
    expect(percentile(values, 0)).toBe(1)
  })

  it('does not mutate the input array', () => {
    const values = [5, 3, 1, 4, 2]
    const copy = [...values]
    percentile(values, 50)
    expect(values).toEqual(copy)
  })
})

describe('summarize', () => {
  it('returns all zeros for empty input', () => {
    expect(summarize([])).toEqual({
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    })
  })

  it('computes summary stats for [2,4,6,8]', () => {
    expect(summarize([2, 4, 6, 8])).toEqual({
      count: 4,
      min: 2,
      max: 8,
      mean: 5,
      p50: 4,
      p90: 8,
      p95: 8,
      p99: 8,
    })
  })
})

describe('errorRate', () => {
  it('returns 0 when total is 0', () => {
    expect(errorRate(0, 0)).toBe(0)
  })

  it('computes error rate as a fraction', () => {
    expect(errorRate(100, 1)).toBe(0.01)
    expect(errorRate(200, 2)).toBe(0.01)
  })

  it('returns 0 when total is negative', () => {
    expect(errorRate(-5, 1)).toBe(0)
  })
})

describe('withinThreshold', () => {
  it('is true when value is below threshold', () => {
    expect(withinThreshold(99, 100)).toBe(true)
  })

  it('is true when value equals threshold', () => {
    expect(withinThreshold(100, 100)).toBe(true)
  })

  it('is false when value exceeds threshold', () => {
    expect(withinThreshold(101, 100)).toBe(false)
  })
})
