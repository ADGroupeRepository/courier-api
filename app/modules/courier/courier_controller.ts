import type { HttpContext } from '@adonisjs/core/http'
import CourierService from '#modules/courier/courier_service'
import MembersService from '#modules/directory/members_service'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'
import { createCourierValidator, updateCourierValidator } from '#modules/courier/courier_validator'

export default class CourierController {
  /**
   * GET /api/v1/organisations/:orgId/couriers
   * List all couriers for the organisation.
   */
  async index({ user, params, request, response }: HttpContext) {
    const orgId = params.orgId
    const type = request.input('type') as 'incoming' | 'outgoing' | undefined

    try {
      // 1. Get user membership roles in this org
      const memberships = await appwrite.teams.listMemberships({
        teamId: orgId,
        search: user?.email || '',
      })
      const membership = memberships.memberships[0]
      const roles = membership?.roles || []

      // 2. Determine if user can manage (owner, admin, or specific manager role)
      const canManage = roles.some((r) => ['owner', 'admin', 'courier_manager'].includes(r))

      // 3. Get user's department assignment
      const memberService = await MembersService.forOrg(orgId)
      const profiles = await appwrite.databases.listDocuments({
        databaseId: (memberService as any).databaseId,
        collectionId: 'org_profiles',
        queries: [Query.equal('userId', user?.$id || '')],
      })
      const departmentId = profiles.documents[0]?.departmentId

      // 4. List couriers with visibility rules
      const service = await CourierService.forOrg(orgId)
      const couriers = await service.list({
        userId: user?.$id || '',
        departmentId,
        canManage,
        type,
      })

      return response.ok({ data: couriers })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/couriers/:id
   * Get a single courier.
   */
  async show({ params, response }: HttpContext) {
    try {
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)
      return response.ok({ data: courier })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/couriers
   * Create a new courier record (supports multipart data with file).
   */
  async store({ user, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(createCourierValidator)

    try {
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.create(
        {
          type: payload.type as 'incoming' | 'outgoing',
          subject: payload.subject,
          sender: payload.sender,
          recipient: payload.recipient,
          assignedTo: payload.assignedTo,
          targetType: payload.targetType as 'user' | 'department',
          createdBy: user?.$id || '',
        },
        payload.file
          ? { tmpPath: payload.file.tmpPath!, fileName: payload.file.clientName }
          : undefined
      )

      return response.created({ data: courier })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PATCH /api/v1/organisations/:orgId/couriers/:id
   * Update a courier record.
   */
  async update({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(updateCourierValidator)

    try {
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.update(params.id, payload)
      return response.ok({ data: courier })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/couriers/:id
   * Delete a courier.
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const service = await CourierService.forOrg(params.orgId)
      await service.delete(params.id)
      return response.ok({ message: 'Courier deleted successfully' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }
}
