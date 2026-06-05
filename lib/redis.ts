import { Redis } from '@upstash/redis'

// Upstash REST client. Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
// Lazily created so importing this module never throws when env is absent
// (e.g. in unit tests, where the cache layer is mocked instead).
let client: Redis | null = null

export function getRedis(): Redis {
  if (!client) client = Redis.fromEnv()
  return client
}
