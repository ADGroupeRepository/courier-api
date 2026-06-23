import type { HttpContext } from '@adonisjs/core/http'
import OrganisationService from '#modules/organisations/organisation_service'
import {
  addMemberValidator,
  updateMemberValidator,
} from '#modules/organisations/organisation_validator'
import PlanService from '#modules/plans/plan_service'
import DepartmentsService from '#modules/directory/departments_service'
import MembersService from '#modules/directory/members_service'
import appwrite from '#services/appwrite_service'

export default class MembersController {
  /**
   * GET /api/v1/organisations/:orgId/members
   * List all members of an organisation.
   */
  async index({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const limit = request.input('limit') ? Number.parseInt(request.input('limit'), 10) : 25
    const page = request.input('page') ? Number.parseInt(request.input('page'), 10) : 1

    const service = new OrganisationService()
    const { documents, total } = await service.listMembers(orgId, { limit, page })

    return response.ok({
      total,
      limit,
      page,
      lastPage: Math.ceil(total / limit),
      data: documents,
    })
  }

  /**
   * GET /api/v1/organisations/:orgId/members/:memberId
   * Retrieve a single member of an organisation by membership ID.
   */
  async show({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const membershipId = request.param('memberId')
    const service = new OrganisationService()
    const member = await service.getMember(orgId, membershipId)

    return response.ok({ data: member })
  }

  /**
   * POST /api/v1/organisations/:orgId/members
   * Add a new member to the organisation by email address.
   * Using the admin API key means the membership is confirmed instantly.
   */
  async store({ request, response }: HttpContext) {
    const orgId = request.param('orgId')

    // Check Plan Limit for Max Members
    const usage = await PlanService.getOrgUsage(orgId)
    if (usage.members.max !== -1 && usage.members.used >= usage.members.max) {
      return response.forbidden({
        message: `Plan limit reached: You can only have ${usage.members.max} members on your current plan.`,
      })
    }

    const { email, role, departmentId, jobTitle, departmentRole } =
      await request.validateUsing(addMemberValidator)

    // Verify department exists in the organization
    try {
      const deptsService = await DepartmentsService.forOrg(orgId)
      await deptsService.get(departmentId)
    } catch {
      return response.notFound({
        message: 'Department not found. Please create a department first.',
      })
    }

    const service = new OrganisationService()
    const membership = await service.addMember(orgId, email, [role])

    // Assign member to the department
    try {
      const membersService = await MembersService.forOrg(orgId)
      await membersService.assignToDepartment({
        userId: membership.userId,
        membershipId: membership.id,
        departmentId,
        jobTitle,
        departmentRole: departmentRole ?? 'member',
      })

      // If assigned as department manager, update department document
      if (departmentRole === 'manager') {
        const deptsService = await DepartmentsService.forOrg(orgId)
        await deptsService.update(departmentId, { managerUserId: membership.userId })
      }
    } catch (assignError: any) {
      // Log error but don't fail the whole request since membership is already created
      // Or we can let it throw, but since they are added, completing assignment is expected.
      // Let's log it or return a message. Actually, since we already checked that the department exists,
      // it should succeed unless there's a constraint error.
      throw assignError
    }

    return response.created({ message: 'Member added successfully', data: membership })
  }

  /**
   * PATCH /api/v1/organisations/:orgId/members/:memberId
   * Update a member's roles within the organisation.
   */
  async update({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const membershipId = request.param('memberId')
    const { role, departmentRole } = await request.validateUsing(updateMemberValidator)

    const service = new OrganisationService()
    let updatedMembership: any = null

    // 1. If role is provided, update organisation-level role
    if (role) {
      updatedMembership = await service.updateMember(orgId, membershipId, [role])
    }

    // 2. If departmentRole is provided, update department-level role
    if (departmentRole) {
      const membership = await appwrite.teams.getMembership({
        teamId: orgId,
        membershipId,
      })

      const membersService = await MembersService.forOrg(orgId)
      await membersService.updateDepartmentRole(membership.userId, departmentRole)

      if (!updatedMembership) {
        updatedMembership = {
          id: membership.$id,
          userId: membership.userId,
          roles: membership.roles,
        }
      }
    }

    return response.ok({ message: 'Member updated successfully', data: updatedMembership })
  }

  /**
   * DELETE /api/v1/organisations/:orgId/members/:memberId
   * Remove a member from the organisation.
   */
  async destroy({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const membershipId = request.param('memberId')

    const service = new OrganisationService()
    await service.removeMember(orgId, membershipId)

    return response.noContent()
  }
}
