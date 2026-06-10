import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { summarize, errorRate, withinThreshold, type LatencySummary } from '@/lib/loadtest/stats'

// Load test orchestrator for the staging /api/search endpoint.
//
//   npx tsx --env-file=.env.staging.local scripts/load-test.ts
//   npx tsx --env-file=.env.staging.local scripts/load-test.ts --smoke

const BASE_URL = process.env.LOADTEST_BASE_URL ?? 'https://staging.wherecaniwatchit.info'

const FULL_CONCURRENCY = 50
const FULL_PER_WORKER = 10

const SMOKE_CONCURRENCY = 3
const SMOKE_PER_WORKER = 2

const THRESHOLDS_MS: Record<Cohort, number> = {
  cached: 100,
  db: 500,
  tmdb: 3000,
}

const MAX_ERROR_RATE = 0.01

const RESULTS_PATH = 'docs/superpowers/reports/load-test-results.json'

type Cohort = 'cached' | 'db' | 'tmdb'

const CACHED_QUERIES = ['inception', 'the matrix', 'severance', 'parasite', 'breaking bad']

const TMDB_QUERIES = [
  'The Taking of Pelham One Two Three',
  'Withnail and I',
  'The Vanishing 1988',
  'Picnic at Hanging Rock',
  'The Wages of Fear',
  'Possession 1981',
  'The Friends of Eddie Coyle',
  'A Brighter Summer Day',
]

interface RequestSpec {
  cohort: Cohort
  query: string
}

interface RequestResult {
  cohort: Cohort
  query: string
  endToEndMs: number
  serverMs: number | null
  status: number
  ok: boolean
  source: string | null
}

interface CohortReport {
  cohort: Cohort
  count: number
  thresholdMs: number
  serverLatency: LatencySummary
  endToEndLatency: LatencySummary
  errorRate: number
  hasServerData: boolean
  pass: boolean
}

interface RunConfig {
  baseUrl: string
  concurrency: number
  perWorker: number
  smoke: boolean
  thresholds: Record<Cohort, number>
  maxErrorRate: number
}

function parseServerTiming(header: string | null): number | null {
  if (!header) return null
  const match = header.match(/dur=([\d.]+)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function fail(message: string): never {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

async function fetchTitlePool(limit: number): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.from('titles').select('title').limit(limit)
  if (error) fail(`Failed to fetch title pool from Supabase: ${error.message}`)
  if (!data) fail('Failed to fetch title pool from Supabase: no data returned')

  const seen = new Set<string>()
  const titles: string[] = []
  for (const row of data) {
    const title = row.title?.trim()
    if (!title) continue
    if (seen.has(title)) continue
    seen.add(title)
    titles.push(title)
  }

  if (titles.length === 0) fail('Title pool from Supabase is empty')

  return titles
}

let globalSeq = 0

async function runRequest(spec: RequestSpec): Promise<RequestResult> {
  const seq = globalSeq++
  const url = `${BASE_URL}/api/search?q=${encodeURIComponent(spec.query)}&_lt=${seq}`

  const start = performance.now()
  try {
    const res = await fetch(url)
    const endToEndMs = performance.now() - start
    const serverMs = parseServerTiming(res.headers.get('Server-Timing'))

    let source: string | null = null
    try {
      const body = (await res.json()) as { source?: unknown }
      if (typeof body.source === 'string') source = body.source
    } catch {
      // ignore JSON parse failures, source stays null
    }

    return {
      cohort: spec.cohort,
      query: spec.query,
      endToEndMs,
      serverMs,
      status: res.status,
      ok: res.status === 200,
      source,
    }
  } catch {
    const endToEndMs = performance.now() - start
    return {
      cohort: spec.cohort,
      query: spec.query,
      endToEndMs,
      serverMs: null,
      status: 0,
      ok: false,
      source: null,
    }
  }
}

async function prewarmCachedQueries(): Promise<void> {
  for (const query of CACHED_QUERIES) {
    const seq = globalSeq++
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(query)}&_lt=${seq}`
    await fetch(url)
  }
}

function buildRequestSpecs(config: RunConfig, dbPool: string[]): RequestSpec[] {
  const specs: RequestSpec[] = []

  if (config.smoke) {
    const total = config.concurrency * config.perWorker
    const dbCount = Math.min(Math.floor(total / 2), dbPool.length)
    const cachedCount = total - dbCount

    for (let i = 0; i < cachedCount; i++) {
      specs.push({ cohort: 'cached', query: CACHED_QUERIES[i % CACHED_QUERIES.length] })
    }
    for (let i = 0; i < dbCount; i++) {
      specs.push({ cohort: 'db', query: dbPool[i] })
    }

    return shuffle(specs)
  }

  const total = config.concurrency * config.perWorker
  const tmdbCount = TMDB_QUERIES.length
  const remaining = total - tmdbCount

  let cachedCount = Math.round(remaining * (50 / 95))
  let dbCount = remaining - cachedCount

  if (dbCount > dbPool.length) {
    const overflow = dbCount - dbPool.length
    dbCount = dbPool.length
    cachedCount += overflow
  }

  for (const query of TMDB_QUERIES) {
    specs.push({ cohort: 'tmdb', query })
  }
  for (let i = 0; i < cachedCount; i++) {
    specs.push({ cohort: 'cached', query: CACHED_QUERIES[i % CACHED_QUERIES.length] })
  }
  for (let i = 0; i < dbCount; i++) {
    specs.push({ cohort: 'db', query: dbPool[i] })
  }

  return shuffle(specs)
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function chunk<T>(items: T[], chunkCount: number, perChunk: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < chunkCount; i++) {
    chunks.push(items.slice(i * perChunk, (i + 1) * perChunk))
  }
  return chunks
}

function buildCohortReport(cohort: Cohort, results: RequestResult[], threshold: number): CohortReport {
  const serverValues = results.map((r) => r.serverMs).filter((v): v is number => v !== null)
  const endToEndValues = results.map((r) => r.endToEndMs)
  const errors = results.filter((r) => !r.ok).length
  const cohortErrorRate = errorRate(results.length, errors)

  const serverLatency = summarize(serverValues)
  const endToEndLatency = summarize(endToEndValues)

  const hasServerData = serverValues.length > 0
  const pass = hasServerData && withinThreshold(serverLatency.p95, threshold) && cohortErrorRate <= MAX_ERROR_RATE

  return {
    cohort,
    count: results.length,
    thresholdMs: threshold,
    serverLatency,
    endToEndLatency,
    errorRate: cohortErrorRate,
    hasServerData,
    pass,
  }
}

function printCohortTable(reports: CohortReport[]): void {
  console.log('\nCohort   | Count | Server p50 | Server p95 | Server p99 | E2E p95 | Error Rate | Result')
  console.log('---------|-------|------------|------------|------------|---------|------------|-------')
  for (const r of reports) {
    const status = !r.hasServerData
      ? 'FAIL (no Server-Timing data)'
      : r.pass
        ? 'PASS'
        : 'FAIL'
    console.log(
      `${r.cohort.padEnd(8)} | ${String(r.count).padEnd(5)} | ` +
        `${r.serverLatency.p50.toFixed(1).padEnd(10)} | ${r.serverLatency.p95.toFixed(1).padEnd(10)} | ` +
        `${r.serverLatency.p99.toFixed(1).padEnd(10)} | ${r.endToEndLatency.p95.toFixed(1).padEnd(7)} | ` +
        `${(r.errorRate * 100).toFixed(2).padEnd(10)}% | ${status} (threshold ${r.thresholdMs}ms)`
    )
  }
}

async function main() {
  const smoke = process.argv.includes('--smoke')

  const config: RunConfig = {
    baseUrl: BASE_URL,
    concurrency: smoke ? SMOKE_CONCURRENCY : FULL_CONCURRENCY,
    perWorker: smoke ? SMOKE_PER_WORKER : FULL_PER_WORKER,
    smoke,
    thresholds: THRESHOLDS_MS,
    maxErrorRate: MAX_ERROR_RATE,
  }

  console.log(`\nLoad test against ${BASE_URL} (${smoke ? 'SMOKE' : 'FULL'} run)`)
  console.log(`Concurrency=${config.concurrency} PerWorker=${config.perWorker} Total=${config.concurrency * config.perWorker}\n`)

  const dbPoolLimit = smoke ? 50 : 400
  const dbPool = await fetchTitlePool(dbPoolLimit)
  console.log(`Title pool size: ${dbPool.length}`)

  console.log('Pre-warming cached cohort queries...')
  await prewarmCachedQueries()

  const specs = buildRequestSpecs(config, dbPool)
  const workers = chunk(specs, config.concurrency, config.perWorker)

  console.log(`Running ${specs.length} requests across ${workers.length} workers...\n`)

  const start = performance.now()
  const results: RequestResult[] = (
    await Promise.all(
      workers.map(async (workerSpecs) => {
        const workerResults: RequestResult[] = []
        for (const spec of workerSpecs) {
          workerResults.push(await runRequest(spec))
        }
        return workerResults
      })
    )
  ).flat()
  const totalDurationMs = performance.now() - start

  const cohorts: Cohort[] = smoke ? ['cached', 'db'] : ['cached', 'db', 'tmdb']
  const cohortReports = cohorts
    .map((cohort) => results.filter((r) => r.cohort === cohort))
    .map((cohortResults, i) => buildCohortReport(cohorts[i], cohortResults, THRESHOLDS_MS[cohorts[i]]))
    .filter((r) => r.count > 0)

  printCohortTable(cohortReports)

  const totalErrors = results.filter((r) => !r.ok).length
  const overallErrorRate = errorRate(results.length, totalErrors)
  const missingServerTiming = results.filter((r) => r.serverMs === null).length
  const overallPass =
    cohortReports.every((r) => r.pass) && overallErrorRate <= MAX_ERROR_RATE && missingServerTiming === 0

  console.log(`\nTotal requests: ${results.length}`)
  console.log(`Total duration: ${(totalDurationMs / 1000).toFixed(2)}s`)
  console.log(`Overall error rate: ${(overallErrorRate * 100).toFixed(2)}%`)
  console.log(`Missing Server-Timing header: ${missingServerTiming}`)
  if (missingServerTiming > 0) {
    console.log(
      `⚠️  ${missingServerTiming} request(s) had no Server-Timing data — this run cannot be trusted. ` +
        `The Server-Timing header is likely not deployed on the target.`
    )
  }
  console.log(`Overall result: ${overallPass ? 'PASS' : 'FAIL'}\n`)

  if (!smoke) {
    const report = {
      timestamp: new Date().toISOString(),
      config,
      cohorts: cohortReports,
      overall: {
        totalRequests: results.length,
        totalDurationMs,
        errorRate: overallErrorRate,
        missingServerTiming,
        pass: overallPass,
      },
      results,
    }

    await mkdir(dirname(RESULTS_PATH), { recursive: true })
    await writeFile(RESULTS_PATH, JSON.stringify(report, null, 2))
    console.log(`Results written to ${RESULTS_PATH}`)

    process.exit(overallPass ? 0 : 1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Load test failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
