import { getRedis } from './redis'
import { captureException } from './observability'

export const SEARCH_TTL = 60 * 60 // 1 hour
export const DETAIL_TTL = 6 * 60 * 60 // 6 hours

const ABBREVIATIONS: Record<string, string> = {
  'p&r': 'parks and recreation',
  got: 'game of thrones',
  himym: 'how i met your mother',
  tbbt: 'the big bang theory',
  aot: 'attack on titan',
}

export function normalizeQuery(raw: string): string {
  const lowered = raw.toLowerCase().trim()
  const expanded = ABBREVIATIONS[lowered] ?? lowered
  return expanded
    .replace(/[^a-z0-9\s-]/g, '') // strip specials except space/hyphen
    .trim()
    .replace(/\s+/g, '-') // spaces → hyphen
    .replace(/-+/g, '-') // collapse hyphens
    .replace(/^-|-$/g, '') // trim leading/trailing hyphen
}

export function searchCacheKey(query: string): string {
  return `search:${normalizeQuery(query)}`
}

export function titleCacheKey(id: string): string {
  return `title:${id}`
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return (await getRedis().get<T>(key)) ?? null
  } catch (err) {
    captureException(err, { op: 'cache.get', key })
    return null
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, value, { ex: ttlSeconds })
  } catch (err) {
    captureException(err, { op: 'cache.set', key })
  }
}

export async function delCached(key: string): Promise<void> {
  try {
    await getRedis().del(key)
  } catch (err) {
    captureException(err, { op: 'cache.del', key })
  }
}
