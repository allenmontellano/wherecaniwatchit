export interface NormalizedQuery {
  query: string
  year: number | null
}

// Whole-string abbreviations (the entire query must equal the key).
const ABBREVIATIONS: Record<string, string> = {
  'p&r': 'parks and recreation',
  got: 'game of thrones',
  himym: 'how i met your mother',
  tbbt: 'the big bang theory',
  aot: 'attack on titan',
  lotr: 'the lord of the rings',
  hotd: 'house of the dragon',
  twd: 'the walking dead',
  bb: 'breaking bad',
  bcs: 'better call saul',
  svu: 'law and order special victims unit',
  asoue: 'a series of unfortunate events',
  atla: 'avatar the last airbender',
  jjk: 'jujutsu kaisen',
  mha: 'my hero academia',
  oitnb: 'orange is the new black',
  iasip: "it's always sunny in philadelphia",
  b99: 'brooklyn nine nine',
  sw: 'star wars',
  hp: 'harry potter',
  potc: 'pirates of the caribbean',
  'f&f': 'fast and furious',
  mi: 'mission impossible',
  dbz: 'dragon ball z',
  ahs: 'american horror story',
}

// Known streaming platforms (+ aliases), longest forms first so multi-word
// aliases win. Used only for the anchored trailing "on <platform>" strip.
const PLATFORMS = [
  'netflix',
  'disney plus', 'disney\\+', 'disney',
  'prime video', 'amazon prime', 'prime', 'amazon',
  'hbo max', 'hbo', 'max',
  'hulu',
  'apple tv\\+', 'apple tv', 'apple',
  'paramount plus', 'paramount\\+', 'paramount',
  'peacock', 'crunchyroll', 'stan', 'binge',
].join('|')

const ON_PLATFORM = new RegExp(
  `\\s+(?:available on|streaming on|is on|now on|on)\\s+(?:${PLATFORMS})\\s*$`,
  'i'
)
const SEASON_EPISODE = /\s+(?:season\s+\d+|s\d+|episode\s+\d+|ep\s+\d+|part\s+\d+)\s*$/i
const LEADING_FILLER = /^(?:where can i watch|where to watch|can i watch|how to watch|watch|is)\s+/i
const TRAILING_FILLER = /\s+(?:streaming|online|free)\s*$/i
const TRAILING_YEAR = /\s+(19|20)\d{2}\s*$/

export function normalizeSearch(raw: string): NormalizedQuery {
  let s = raw.toLowerCase().trim().replace(/\s+/g, ' ')

  const expanded = ABBREVIATIONS[s]
  if (expanded) return { query: expanded, year: null }

  let year: number | null = null
  const ym = s.match(TRAILING_YEAR)
  if (ym) {
    year = parseInt(ym[0].trim(), 10)
    s = s.slice(0, ym.index).trim()
  }

  s = s.replace(SEASON_EPISODE, '').trim()
  s = s.replace(ON_PLATFORM, '').trim()
  s = s.replace(LEADING_FILLER, '').trim()
  s = s.replace(TRAILING_FILLER, '').trim()
  s = s.replace(/\s+/g, ' ').trim()

  return { query: s, year }
}
