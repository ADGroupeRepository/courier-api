import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Global middleware to add recommended HTTP security headers to all responses.
 * Sets X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.
 */
export default class SecurityHeadersMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.response.header('X-Frame-Options', 'DENY')
    ctx.response.header('X-Content-Type-Options', 'nosniff')
    ctx.response.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    return next()
  }
}
