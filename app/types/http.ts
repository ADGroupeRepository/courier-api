import { type Client, Models } from 'node-appwrite'

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

    /**
     * The current organization membership of the authenticated user.
     */
    orgMembership?: Models.Membership

    /**
     * The roles of the user within the current organization.
     */
    orgRoles?: string[]

    /**
     * True if the user is an admin or owner of the organization.
     */
    isOrgAdmin?: boolean

    /**
     * True if the user is the owner of the organization.
     */
    isOrgOwner?: boolean

    /**
     * True if the user has the 'secretariat' role.
     */
    isOrgSecretariat?: boolean
  }
}
