import type { HttpContext } from '@adonisjs/core/http'
import PlanService from '#modules/plans/plan_service'
import { assignLicenseValidator } from '#modules/plans/plan_validator'
import appwrite from '#services/appwrite_service'
import { Collections } from '#modules/_registry/collection_ids'
import { Query } from 'node-appwrite'

/**
 * Controller for Organisation Admins to manage their seat licenses.
 */
export default class OrgLicensesController {
  private readonly databaseId = 'bara-platform'

  /**
   * GET /api/v1/organisations/:orgId/licenses
   * List all assigned seat licenses in the organisation.
   */
  async index({ request, response }: HttpContext) {
    const orgId = request.param('orgId')

    try {
      const result = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: Collections.LICENSES,
        queries: [
          Query.equal('orgId', orgId),
          Query.equal('isActive', true),
          Query.orderDesc('$createdAt'),
        ],
      })

      return response.ok({ data: result.documents, total: result.total })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/licenses/assign
   * Assign a seat license to a user.
   */
  async assign({ request, response, user, isOrgAdmin }: HttpContext) {
    const orgId = request.param('orgId')

    if (!isOrgAdmin) {
      return response.forbidden({ message: 'Only organisation admins can manage licenses.' })
    }

    const payload = await request.validateUsing(assignLicenseValidator)

    if (!user) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    try {
      const license = await PlanService.assignLicenseToUser(orgId, user.$id, payload.userId)
      return response.created({ data: license, message: 'License assigned successfully.' })
    } catch (error: any) {
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/licenses/revoke
   * Revoke a seat license from a user.
   */
  async revoke({ request, response, isOrgAdmin }: HttpContext) {
    const orgId = request.param('orgId')

    if (!isOrgAdmin) {
      return response.forbidden({ message: 'Only organisation admins can manage licenses.' })
    }

    const payload = await request.validateUsing(assignLicenseValidator)

    try {
      const license = await PlanService.revokeLicenseFromUser(orgId, payload.userId)
      return response.ok({ data: license, message: 'License revoked successfully.' })
    } catch (error: any) {
      return response.badRequest({ message: error.message })
    }
  }
}
