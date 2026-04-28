import type { HttpContext } from '@adonisjs/core/http'
import MembersService from '#modules/directory/members_service'
import { assignMemberValidator } from '#modules/directory/members_validator'

export default class DepartmentMembersController {
  /**
   * POST /api/v1/organisations/:orgId/members/:membershipId/department
   * Assign a member to a department.
   */
  async assign({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(assignMemberValidator, {
      data: {
        ...request.all(),
        organisationId: params.orgId,
        membershipId: params.membershipId,
      },
    })

    try {
      const service = await MembersService.forOrg(params.orgId)
      const profile = await service.assignToDepartment({
        userId: payload.userId,
        membershipId: params.membershipId,
        departmentId: payload.departmentId,
        jobTitle: payload.jobTitle,
        departmentRole: payload.departmentRole as 'manager' | 'member',
      })

      return response.ok({ data: profile })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/departments/:id/members
   * List all members in a specific department.
   */
  async indexByDepartment({ params, response }: HttpContext) {
    const orgId = params.orgId
    const departmentId = params.id

    try {
      const service = await MembersService.forOrg(orgId)
      const members = await service.listByDepartment(departmentId)
      return response.ok({ data: members })
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
