import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Account, Client } from 'node-appwrite'
import appwriteConfig from '#config/appwrite'

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
    const authHeader = ctx.request.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.response.unauthorized({
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
      })
    }

    const token = authHeader.slice(7).trim()

    if (!token) {
      return ctx.response.unauthorized({ message: 'Empty token provided' })
    }

    try {
      const sessionClient = new Client()
        .setEndpoint(appwriteConfig.endpoint)
        .setProject(appwriteConfig.projectId)
        .setJWT(token)
        .setSelfSigned(true)

      const account = new Account(sessionClient)
      const user = await account.get()

      ctx.user = user
      ctx.sessionClient = sessionClient
    } catch {
      return ctx.response.unauthorized({
        message: 'Invalid or expired token. Please log in again.',
      })
    }

    return next()
  }
}
