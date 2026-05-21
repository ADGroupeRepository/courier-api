import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Middleware to protect platform admin routes.
 * Ensures the authenticated user has the 'admin' label in Appwrite.
 */
export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.user) {
      ctx.logger.warn(
        {
          url: ctx.request.url(),
          ip: ctx.request.ip(),
        },
        'Admin check failed: request is unauthenticated'
      )
      return ctx.response.unauthorized({ message: 'Authentication required' })
    }

    const labels: string[] = ctx.user.labels || []

    if (!labels.includes('admin')) {
      ctx.logger.warn(
        {
          userId: ctx.user.$id,
          labels,
          url: ctx.request.url(),
          ip: ctx.request.ip(),
        },
        'Admin check failed: user does not have admin label'
      )
      return ctx.response.forbidden({
        message:
          'Platform admin access required. You do not have the required permissions to perform this action.',
      })
    }

    return next()
  }
}
