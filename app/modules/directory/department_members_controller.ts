import type { HttpContext } from '@adonisjs/core/http'
import MembersService from '#modules/directory/members_service'
import { assignMemberValidator } from '#modules/directory/members_validator'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'

export default class DepartmentMembersController {
  /**
   * POST /api/v1/organisations/:orgId/departments/assign
   * Assign a member to a department.
   */
  async assign({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(assignMemberValidator)

    try {
      // Resolve membershipId from the Teams API using the userId
      const memberships = await appwrite.teams.listMemberships({
        teamId: params.orgId,
        queries: [Query.equal('userId', payload.userId)],
      })

      if (memberships.total === 0) {
        return response.notFound({
          message: 'User is not a member of this organisation.',
        })
      }

      const membershipId = memberships.memberships[0].$id

      const service = await MembersService.forOrg(params.orgId)
      const profile = await service.assignToDepartment({
        userId: payload.userId,
        membershipId,
        departmentId: payload.departmentId,
        jobTitle: payload.jobTitle,
        departmentRole: payload.departmentRole,
      })

      return response.ok({ data: profile })
    } catch (error: any) {
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/departments/:id/members
   * List all members in a specific department.
   */
  async indexByDepartment({ request, params, response }: HttpContext) {
    const orgId = params.orgId
    const departmentId = params.id
    const limit = request.input('limit') ? Number.parseInt(request.input('limit'), 10) : 25
    const page = request.input('page') ? Number.parseInt(request.input('page'), 10) : 1

    try {
      const service = await MembersService.forOrg(orgId)
      const { documents, total } = await service.listByDepartment(departmentId, { limit, page })
      return response.ok({
        total,
        limit,
        page,
        lastPage: Math.ceil(total / limit),
        data: documents,
      })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/profiles/:id
   * Remove a user from their department (deletes profile).
   */
  async destroy({ params, response }: HttpContext) {
    const orgId = params.orgId
    const profileId = params.id

    try {
      const service = await MembersService.forOrg(orgId)
      await service.removeFromDepartment(profileId)
      return response.ok({ message: 'Member removed from department successfully' })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }
}
