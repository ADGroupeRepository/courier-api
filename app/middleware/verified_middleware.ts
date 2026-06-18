import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * VerifiedMiddleware prevents unverified users from accessing routes.
 * Must run AFTER AuthMiddleware, as it relies on `ctx.user` being populated.
 */
export default class VerifiedMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.user) {
      return ctx.response.unauthorized({
        message: 'Authentication required. Please log in first.',
      })
    }

    if (!ctx.user.emailVerification) {
      return ctx.response.forbidden({
        message: 'Your email address must be verified to perform this action.',
      })
    }

    return next()
  }
}
