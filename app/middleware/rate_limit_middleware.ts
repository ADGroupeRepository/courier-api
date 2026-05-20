import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import limiter from '@adonisjs/limiter/services/main'
import { errors as limiterErrors } from '@adonisjs/limiter'
import logger from '@adonisjs/core/services/logger'

interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  max: number
  /** Time window in milliseconds */
  windowMs: number
}

/**
 * Redis-backed sliding window rate limiter.
 *
 * Options are passed as a third argument via AdonisJS named middleware:
 *   `middleware.rateLimit({ max: 10, windowMs: 60_000 })`
 *
 * Keyed by IP + route path. Thread-safe and compatible with multi-process/clustered setups.
 */
export default class RateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options?: RateLimitOptions) {
    const { max = 60, windowMs = 60_000 } = options ?? {}

    const ip = ctx.request.ip()
    const url = ctx.request.url()
    const key = `rate_limit:${ip}:${url}`

    // Convert windowMs to seconds for @adonisjs/limiter
    const durationSec = Math.max(1, Math.ceil(windowMs / 1000))

    try {
      // Create a dynamic rate limiter instance with the default Redis store
      const rateLimiter = limiter.use({
        requests: max,
        duration: `${durationSec}s`,
      })

      // Consume 1 point for the key (IP + URL)
      const result = await rateLimiter.consume(key)

      // Set standard headers on success
      ctx.response.header('X-RateLimit-Limit', String(max))
      ctx.response.header('X-RateLimit-Remaining', String(result.remaining))
    } catch (err: any) {
      if (err instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
        const retryAfter = Math.max(1, err.response.availableIn)
        ctx.response.header('Retry-After', String(retryAfter))
        ctx.response.header('X-RateLimit-Limit', String(max))
        ctx.response.header('X-RateLimit-Remaining', '0')

        return ctx.response.tooManyRequests({
          message: `Too many requests. Please retry after ${retryAfter} seconds.`,
          retryAfter: retryAfter,
        })
      }

      logger.error({ err, key }, '[RateLimitMiddleware] Redis rate limiter failed. Failing open.')
      // Fallback: If Redis/Limiter fails, allow the request to prevent service disruption
      return next()
    }

    return next()
  }
}
