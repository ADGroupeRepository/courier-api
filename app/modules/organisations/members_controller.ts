import type { HttpContext } from '@adonisjs/core/http'
import OrganisationService from '#modules/organisations/organisation_service'
import {
  addMemberValidator,
  updateMemberValidator,
} from '#modules/organisations/organisation_validator'
import PlanService from '#modules/plans/plan_service'

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

    const { email, role } = await request.validateUsing(addMemberValidator)

    const service = new OrganisationService()
    const membership = await service.addMember(orgId, email, [role])

    return response.created({ message: 'Member added successfully', data: membership })
  }

  /**
   * PATCH /api/v1/organisations/:orgId/members/:memberId
   * Update a member's roles within the organisation.
   */
  async update({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const membershipId = request.param('memberId')
    const { role } = await request.validateUsing(updateMemberValidator)

    const service = new OrganisationService()
    const membership = await service.updateMember(orgId, membershipId, [role])

    return response.ok({ message: 'Member roles updated', data: membership })
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
