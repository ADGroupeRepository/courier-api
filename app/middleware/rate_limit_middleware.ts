import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  max: number
  /** Time window in milliseconds */
  windowMs: number
}

interface RequestRecord {
  count: number
  windowStart: number
}

/**
 * In-memory sliding window rate limiter.
 *
 * Options are passed as a third argument via AdonisJS named middleware:
 *   `middleware.rateLimit({ max: 10, windowMs: 60_000 })`
 *
 * Keyed by IP + route path. Safe for single-process deployments.
 * For multi-process/clustered setups, swap the store with a Redis adapter.
 */
export default class RateLimitMiddleware {
  private static readonly store = new Map<string, RequestRecord>()

  handle(ctx: HttpContext, next: NextFn, options?: RateLimitOptions) {
    const { max = 60, windowMs = 60_000 } = options ?? {}

    const ip = ctx.request.ip()
    const key = `${ip}:${ctx.request.url()}`
    const now = Date.now()

    const record = RateLimitMiddleware.store.get(key)

    if (!record || now - record.windowStart >= windowMs) {
      // First request in this window, or window has expired — reset
      RateLimitMiddleware.store.set(key, { count: 1, windowStart: now })
    } else if (record.count >= max) {
      const retryAfterMs = windowMs - (now - record.windowStart)
      const retryAfterSec = Math.ceil(retryAfterMs / 1000)

      ctx.response.header('Retry-After', String(retryAfterSec))
      ctx.response.header('X-RateLimit-Limit', String(max))
      ctx.response.header('X-RateLimit-Remaining', '0')

      return ctx.response.tooManyRequests({
        message: `Too many requests. Please retry after ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      })
    } else {
      record.count++
    }

    const remaining = max - (RateLimitMiddleware.store.get(key)?.count ?? 1)
    ctx.response.header('X-RateLimit-Limit', String(max))
    ctx.response.header('X-RateLimit-Remaining', String(Math.max(0, remaining)))

    return next()
  }
}
