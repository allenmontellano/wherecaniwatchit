export interface LatencySummary {
  count: number
  min: number
  max: number
  mean: number
  p50: number
  p90: number
  p95: number
  p99: number
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const index = Math.min(Math.max(Math.ceil((p / 100) * n) - 1, 0), n - 1)

  return sorted[index]
}

export function summarize(values: number[]): LatencySummary {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    }
  }

  const count = values.length
  const sum = values.reduce((acc, v) => acc + v, 0)

  return {
    count,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: sum / count,
    p50: percentile(values, 50),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  }
}

export function errorRate(total: number, errors: number): number {
  return total <= 0 ? 0 : errors / total
}

export function withinThreshold(value: number, threshold: number): boolean {
  return value <= threshold
}
