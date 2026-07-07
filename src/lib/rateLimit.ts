import { Redis } from 'ioredis'

type LimitOptions = {
  key: string
  limit: number
  windowSeconds: number
}

const memoryHits = new Map<string, { count: number; resetAt: number }>()
let redis: Redis | null = null

function getRedis() {
  if (!process.env.REDIS_URL) return null
  redis ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
  })
  return redis
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function checkRateLimit({ key, limit, windowSeconds }: LimitOptions) {
  if (process.env.RATE_LIMIT_ENABLED === 'false') return { ok: true, remaining: limit }

  const redisClient = getRedis()
  if (redisClient) {
    const count = await redisClient.incr(key)
    if (count === 1) await redisClient.expire(key, windowSeconds)
    return { ok: count <= limit, remaining: Math.max(0, limit - count) }
  }

  const now = Date.now()
  const current = memoryHits.get(key)
  if (!current || current.resetAt <= now) {
    memoryHits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return { ok: true, remaining: limit - 1 }
  }
  current.count += 1
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count) }
}
