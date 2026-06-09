import { getRedis } from './redis'
import { captureException } from './observability'
import { appEnv } from './env'

export const SEARCH_TTL = 60 * 60 // 1 hour
export const DETAIL_TTL = 6 * 60 * 60 // 6 hours

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
  return `${appEnv()}:search:${year ? `${slug}-${year}` : slug}`
}

export function titleCacheKey(id: string): string {
  return `${appEnv()}:title:${id}`
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
