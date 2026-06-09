import { performSearch } from '@/lib/search'

// Integration smoke test for the search quality pipeline. Run against a database
// that has the FTS + pg_trgm migrations applied and titles seeded:
//   tsx --env-file=.env.staging.local scripts/search-quality-check.ts
// A case passes if any returned title contains the expected title (case-insensitive),
// which tolerates fuller seeded names (e.g. "Demon Slayer: ... Infinity Castle").

interface Case {
  q: string
  expect: string
  kind: 'exact' | 'partial' | 'case' | 'fuzzy'
}

const CASES: Case[] = [
  { q: 'the matrix', expect: 'The Matrix', kind: 'exact' },
  { q: 'matrix', expect: 'The Matrix', kind: 'partial' },
  { q: 'THE MATRIX', expect: 'The Matrix', kind: 'case' },
  { q: 'the devil wears prada', expect: 'The Devil Wears Prada', kind: 'exact' },
  { q: 'devil wears', expect: 'The Devil Wears Prada', kind: 'partial' },
  { q: 'mortal kombat', expect: 'Mortal Kombat', kind: 'exact' },
  { q: 'demon slayer', expect: 'Demon Slayer', kind: 'partial' },
  { q: 'the matric', expect: 'The Matrix', kind: 'fuzzy' },
  { q: 'mortl kombat', expect: 'Mortal Kombat', kind: 'fuzzy' },
  { q: 'the devil wears prda', expect: 'The Devil Wears Prada', kind: 'fuzzy' },
]

async function main() {
  let pass = 0
  for (const c of CASES) {
    const res = await performSearch(c.q)
    const titles = res.results.map((r) => r.title.title)
    const ok = titles.some((t) => t.toLowerCase().includes(c.expect.toLowerCase()))
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  [${c.kind}] "${c.q}" (${res.source}) -> [${titles.join(', ') || '∅'}]  expect "${c.expect}"`
    )
    if (ok) pass++
  }
  console.log(`\n${pass}/${CASES.length} passed`)
  if (pass < CASES.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
