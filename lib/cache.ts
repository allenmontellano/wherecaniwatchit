import { getRedis } from './redis'
import { captureException } from './observability'
import { appEnv } from './env'
import { withTimeout } from './with-timeout'

export const SEARCH_TTL = 60 * 60 // 1 hour
export const DETAIL_TTL = 6 * 60 * 60 // 6 hours
// Cache is best-effort: if Redis is unreachable, fail open fast rather than hang.
export const CACHE_TIMEOUT_MS = 3_000

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function searchCacheKey(query: string, year: number | null = null): string {
  const slug = slugify(query)
  // `:` (already stripped by slugify) separates the year so a plain query ending
  // in digits can never collide with a year-scoped key.
  return `${appEnv()}:search:${year !== null ? `${slug}:${year}` : slug}`
}

export function titleCacheKey(id: string): string {
  return `${appEnv()}:title:${id}`
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    return (await withTimeout(getRedis().get<T>(key), CACHE_TIMEOUT_MS, 'cache.get')) ?? null
  } catch (err) {
    captureException(err, { op: 'cache.get', key })
    return null
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await withTimeout(getRedis().set(key, value, { ex: ttlSeconds }), CACHE_TIMEOUT_MS, 'cache.set')
  } catch (err) {
    captureException(err, { op: 'cache.set', key })
  }
}

export async function delCached(key: string): Promise<void> {
  try {
    await withTimeout(getRedis().del(key), CACHE_TIMEOUT_MS, 'cache.del')
  } catch (err) {
    captureException(err, { op: 'cache.del', key })
  }
}
