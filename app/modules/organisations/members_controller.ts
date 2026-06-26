import DepartmentsService from '#modules/directory/departments_service'
import MembersService from '#modules/directory/members_service'
import OrganisationService from '#modules/organisations/organisation_service'
import {
  addMemberValidator,
  updateMemberValidator,
} from '#modules/organisations/organisation_validator'
import PlanService from '#modules/plans/plan_service'
import appwrite from '#services/appwrite_service'
import type { HttpContext } from '@adonisjs/core/http'
import { Query } from 'node-appwrite'

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
    const membershipId = request.param('userId')
    const service = new OrganisationService()
    const member = await service.getMember(orgId, membershipId)

    return response.ok({ data: member })
  }

  /**
   * Helper to resolve a membership by membership ID or user ID.
   */
  private async resolveTargetMembership(orgId: string, memberIdOrUserId: string) {
    try {
      return await appwrite.teams.getMembership({ teamId: orgId, membershipId: memberIdOrUserId })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }

      const memberships = await appwrite.teams.listMemberships({
        teamId: orgId,
        queries: [Query.equal('userId', memberIdOrUserId)],
      })

      if (memberships.total === 0) {
        throw error
      }

      return memberships.memberships[0]
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/members
   * Add a new member to the organisation by email address.
   * Using the admin API key means the membership is confirmed instantly.
   */
  async store({ request, response, isOrgAdmin }: HttpContext) {
    const orgId = request.param('orgId')

    if (!isOrgAdmin) {
      return response.forbidden({
        message: 'Only organisation owners or admins can add members.',
      })
    }

    // Check Plan Limit for Max Members
    const usage = await PlanService.getOrgUsage(orgId)
    if (usage.members.max !== -1 && usage.members.used >= usage.members.max) {
      return response.forbidden({
        message: `Plan limit reached: You can only have ${usage.members.max} members on your current plan.`,
      })
    }

    const { email, role, name, departments, jobTitle } =
      await request.validateUsing(addMemberValidator)

    const departmentAssignmentsById = new Map<string, 'manager' | 'member'>()

    for (const department of departments ?? []) {
      departmentAssignmentsById.set(department.id, department.role ?? 'member')
    }

    const departmentAssignments = [...departmentAssignmentsById].map(
      ([departmentId, assignmentRole]) => ({
        departmentId,
        departmentRole: assignmentRole,
      })
    )
    const selectedDepartmentIds = departmentAssignments.map((assignment) => assignment.departmentId)

    if (role !== 'admin' && role !== 'secretariat' && departmentAssignments.length === 0) {
      return response.badRequest({
        message: 'At least one department must be provided for non-admin members.',
      })
    }

    let deptsService: DepartmentsService | null = null

    if (departmentAssignments.length > 0) {
      deptsService = await DepartmentsService.forOrg(orgId)

      try {
        await Promise.all(
          selectedDepartmentIds.map((departmentId) => deptsService!.get(departmentId))
        )
      } catch {
        return response.notFound({
          message: 'One or more departments were not found.',
        })
      }
    }

    const service = new OrganisationService()
    const membership = await service.addMember(orgId, email, [role], name)

    if (role === 'secretariat') {
      try {
        await service.ensureCourierDepartmentAndSecretariatMembers(orgId)
      } catch (err: any) {
        // Log error but do not fail the request
        console.error('Failed to auto-assign secretariat member to Courier Service department', err)
      }
    }

    if (departmentAssignments.length > 0) {
      try {
        const membersService = await MembersService.forOrg(orgId)

        await Promise.all(
          departmentAssignments.map((assignment) =>
            membersService.assignToDepartment({
              userId: membership.userId,
              membershipId: membership.id,
              departmentId: assignment.departmentId,
              jobTitle,
              departmentRole: assignment.departmentRole,
            })
          )
        )

        await Promise.all(
          departmentAssignments
            .filter((assignment) => assignment.departmentRole === 'manager')
            .map((assignment) =>
              deptsService!.update(assignment.departmentId, { managerUserId: membership.userId })
            )
        )
      } catch (assignError: any) {
        throw assignError
      }
    }

    return response.created({
      message: 'Member added successfully',
      data: {
        ...membership,
        departments: departmentAssignments,
      },
    })
  }

  /**
   * PATCH /api/v1/organisations/:orgId/members/:memberId
   * Update a member's roles within the organisation.
   */
  async update({ request, response, isOrgAdmin, isOrgOwner }: HttpContext) {
    const orgId = request.param('orgId')
    const membershipId = request.param('userId')

    if (!isOrgAdmin) {
      return response.forbidden({
        message: 'Only organisation owners or admins can update members.',
      })
    }

    const { role, name, departments, jobTitle } = await request.validateUsing(updateMemberValidator)

    const service = new OrganisationService()
    let updatedMembership: any = null

    // Fetch the target member's current membership
    const membership = await this.resolveTargetMembership(orgId, membershipId)

    const targetIsOwner = membership.roles?.includes('owner') ?? false

    // Block non-owners from modifying an owner's membership
    if (targetIsOwner && !isOrgOwner) {
      return response.forbidden({
        message: "Only organisation owners can modify another owner's membership.",
      })
    }

    // 1. If role is provided, update organisation-level role
    if (role) {
      // Preserve the 'owner' role if the target already has it
      const newRoles = targetIsOwner ? ['owner', role] : [role]
      // Deduplicate in case role === 'owner'
      const uniqueRoles = [...new Set(newRoles)]
      updatedMembership = await service.updateMember(orgId, membership.$id, uniqueRoles)

      if (uniqueRoles.includes('secretariat')) {
        try {
          await service.ensureCourierDepartmentAndSecretariatMembers(orgId)
        } catch (err: any) {
          console.error(
            'Failed to auto-assign secretariat member to Courier Service department',
            err
          )
        }
      }
    }

    // 2. If name is provided, update the Appwrite user display name
    if (name !== undefined) {
      await appwrite.users.updateName({ userId: membership.userId, name })
    }

    // 3. If department assignments or job title are provided, update them
    if (departments !== undefined || jobTitle !== undefined) {
      const membersService = await MembersService.forOrg(orgId)
      await membersService.updateDepartmentAssignments({
        userId: membership.userId,
        membershipId: membership.$id,
        departments,
        jobTitle,
      })
    }

    if (!updatedMembership) {
      updatedMembership = {
        id: membership.$id,
        userId: membership.userId,
        roles: membership.roles,
      }
    }

    return response.ok({ message: 'Member updated successfully', data: updatedMembership })
  }

  /**
   * DELETE /api/v1/organisations/:orgId/members/:memberId
   * Remove a member from the organisation.
   */
  async destroy({ request, response, isOrgAdmin }: HttpContext) {
    const orgId = request.param('orgId')
    const membershipId = request.param('userId')

    if (!isOrgAdmin) {
      return response.forbidden({
        message: 'Only organisation owners or admins can remove members.',
      })
    }

    // Fetch the target member and block removal of owners
    const targetMembership = await this.resolveTargetMembership(orgId, membershipId)

    if (targetMembership.roles?.includes('owner')) {
      return response.forbidden({
        message: 'Organisation owners cannot be removed. Transfer ownership first.',
      })
    }

    const service = new OrganisationService()
    await service.removeMember(orgId, targetMembership.$id)

    return response.noContent()
  }
}
