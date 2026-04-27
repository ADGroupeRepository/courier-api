import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Middleware to protect platform admin routes.
 * Ensures the authenticated user has the 'admin' label in Appwrite.
 */
export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.user) {
      return ctx.response.unauthorized({ message: 'Authentication required' })
    }

    const labels: string[] = ctx.user.labels || []
    
    if (!labels.includes('admin')) {
      return ctx.response.forbidden({ 
        message: 'Platform admin access required. You do not have the required permissions to perform this action.' 
      })
    }

    return next()
  }
}
