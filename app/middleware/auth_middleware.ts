import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Validates the Bearer JWT on every protected request.
 *
 * - Extracts the token from the `Authorization: Bearer <token>` header.
 * - Creates a session-scoped Appwrite client for this specific request.
 * - Calls `account.get()` to verify the token is valid and active.
 * - Attaches `ctx.user` and `ctx.sessionClient` for downstream use.
 * - Returns 401 immediately if the token is missing, malformed, or invalid.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const authHeader =
      ctx.request.header('X-Forwarded-Authorization') || ctx.request.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.response.unauthorized({
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
      })
    }

    ctx.logger.info('Authenticating incoming request')

    const token = authHeader.slice(7).trim()

    if (!token) {
      return ctx.response.unauthorized({ message: 'Empty token provided' })
    }

    try {
      ctx.logger.debug('Validating session credentials')
      const appwriteModule = await import('#services/appwrite_service')
      const appwrite = appwriteModule.default
      const { client, account } = appwrite.createSessionClient(token)

      const user = await account.get()

      ctx.user = user
      ctx.token = token
      ctx.sessionClient = client
    } catch (error: any) {
      ctx.logger.warn('Session authentication failed')
      return ctx.response.unauthorized({
        message: 'Invalid or expired token. Please log in again.',
      })
    }

    return next()
  }
}
