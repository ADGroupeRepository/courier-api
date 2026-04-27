import { type Client } from 'node-appwrite'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /**
     * The authenticated Appwrite user. Available on all routes
     * protected by AuthMiddleware.
     */
    user?: {
      $id: string
      name: string
      email: string
      phone: string
      emailVerification: boolean
      phoneVerification: boolean
      labels: string[]
      prefs: Record<string, any>
      status: boolean
      $createdAt: string
      $updatedAt: string
    }

    /**
     * A session-scoped Appwrite client built from the request's JWT.
     * Respects Appwrite permission rules for the authenticated user.
     */
    sessionClient?: Client

    /**
     * The raw JWT token used for authentication.
     */
    token?: string
  }
}
