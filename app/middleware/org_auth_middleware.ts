import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'

/**
 * OrgAuthMiddleware verifies that the authenticated user is a member of the
 * specified organisation and populates org-related properties on the HttpContext.
 * Must run AFTER AuthMiddleware, as it relies on `ctx.user` being populated.
 */
export default class OrgAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.user) {
      return ctx.response.unauthorized({
        message: 'Authentication required. Please log in first.',
      })
    }

    const orgId = ctx.params.orgId || ctx.request.header('X-Organisation-ID')

    if (!orgId) {
      return ctx.response.badRequest({
        message: 'Organisation ID is required.',
      })
    }

    try {
      const memberships = await appwrite.teams.listMemberships({
        teamId: orgId,
        queries: [Query.equal('userId', ctx.user.$id)],
      })

      if (memberships.total === 0) {
        return ctx.response.forbidden({
          message: 'You are not a member of this organisation.',
        })
      }

      const membership = memberships.memberships[0]
      const roles = membership.roles || []

      ctx.orgMembership = membership
      ctx.orgRoles = roles
      ctx.isOrgOwner = roles.includes('owner')
      ctx.isOrgAdmin = roles.some((r) => ['owner', 'admin'].includes(r))
      ctx.isOrgSecretariat = roles.includes('secretariat')
    } catch (error: any) {
      ctx.logger.error({ err: error }, 'Organisation authorization check failed')
      return ctx.response.forbidden({
        message: 'Failed to verify organization membership.',
      })
    }

    return next()
  }
}
