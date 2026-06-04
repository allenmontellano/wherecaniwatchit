import { getQuota } from '@/lib/quota'
import { searchTMDB } from '@/lib/tmdb/client'
import { syncTitle } from '@/lib/sync'
import { createAdminClient } from '@/lib/supabase/admin'

const TARGET = 'Parks and Recreation'
const REGIONS = ['PH', 'US', 'GB', 'AU', 'CA']
const REQUIRED_ENV = [
  'TMDB_API_KEY',
  'MOTN_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

function fail(message: string): never {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

async function main() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missing.length) fail(`Missing env vars: ${missing.join(', ')}`)

  const before = await getQuota('motn')
  console.log(`\nQuota at start: ${before.callsUsed}/${before.callsLimit} (remaining ${before.remaining})\n`)

  // 1) TMDB — free, unlimited
  console.log(`1) TMDB: searching "${TARGET}"...`)
  const results = await searchTMDB(TARGET)
  const hit = results.find((r) => r.media_type === 'tv') ?? results[0]
  if (!hit) fail('TMDB returned no results — check TMDB_API_KEY')
  console.log(
    `   ✅ TMDB OK — tmdb_id=${hit.id}, type=${hit.media_type}, name="${hit.name ?? hit.title ?? '(unknown)'}"`
  )

  // 2 + 3) MOTN availability + Supabase write via syncTitle — exactly 1 MOTN call
  console.log(`\n2) MOTN + Supabase: syncing "${TARGET}" (1 MOTN call, writes DB)...`)
  const synced = await syncTitle(hit)
  console.log(`   ✅ MOTN OK — availability by region:`)
  for (const region of REGIONS) {
    const slugs = synced.availabilityByRegion[region] ?? []
    console.log(`      ${region}: ${slugs.length ? slugs.join(', ') : '(none)'}`)
  }

  // 4) Read back from Supabase to confirm persistence
  console.log(`\n3) Supabase: reading back the stored rows...`)
  const supabase = createAdminClient()
  const { data: title, error: tErr } = await supabase
    .from('titles')
    .select('id, title, tmdb_id')
    .eq('tmdb_id', hit.id)
    .single()
  if (tErr || !title) fail(`Supabase title read failed: ${tErr?.message}`)
  const { count, error: aErr } = await supabase
    .from('availability')
    .select('*', { count: 'exact', head: true })
    .eq('title_id', title.id)
  if (aErr) fail(`Supabase availability read failed: ${aErr.message}`)
  console.log(`   ✅ Supabase OK — title "${title.title}" (id ${title.id}); ${count} availability rows`)

  const after = await getQuota('motn')
  console.log(`\n=== Phase A complete ===`)
  console.log(`MOTN calls used this run: ${after.callsUsed - before.callsUsed}`)
  console.log(`Quota now: ${after.callsUsed}/${after.callsLimit} (remaining ${after.remaining})\n`)
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
