import type { HttpContext } from '@adonisjs/core/http'
import CourierService from '#modules/courier/courier_service'
import MembersService from '#modules/directory/members_service'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'
import {
  createCourierUploadUrlValidator,
  createCourierValidator,
  updateCourierValidator,
} from '#modules/courier/courier_validator'
import { type CourierType } from '#modules/courier/courier_enums'
import { Collections } from '#modules/_registry/collection_ids'
import emitter from '@adonisjs/core/services/emitter'
import CourierAssigned from '#events/courier_assigned'

export default class CourierController {
  /**
   * Helper to get user roles and department in an organisation.
   */
  private async getUserContext(user: any, orgId: string) {
    // 1. Get user membership roles in this org
    const memberships = await appwrite.teams.listMemberships({
      teamId: orgId,
      queries: [Query.equal('userId', user?.$id || '')],
    })

    if (memberships.total === 0) {
      throw new Error('User is not a member of this organisation')
    }

    const membership = memberships.memberships[0]
    const roles = membership?.roles || []

    // 2. Determine if user can manage
    const canManage = roles.some((r) => ['owner', 'admin', 'courier_manager'].includes(r))

    // 3. Get user's department assignment
    const memberService = await MembersService.forOrg(orgId)
    const profiles = await appwrite.databases.listDocuments({
      databaseId: memberService.databaseId,
      collectionId: Collections.ORG_PROFILES,
      queries: [Query.equal('userId', user?.$id || '')],
    })
    const departmentId = profiles.documents[0]?.departmentId

    return { roles, canManage, departmentId }
  }

  /**
   * GET /api/v1/organisations/:orgId/couriers
   * List all couriers for the organisation.
   */
  async index({ user, params, request, response }: HttpContext) {
    const orgId = params.orgId
    const type = request.input('type') as CourierType | undefined
    const archived = request.input('archived') as string | undefined
    const favorite = request.input('favorite') as string | undefined
    const deleted = request.input('deleted') as string | undefined
    const limit = Number(request.input('limit')) || 25
    const page = Number(request.input('page')) || 1

    try {
      const { canManage, departmentId } = await this.getUserContext(user, orgId)

      // List couriers with visibility rules
      const service = await CourierService.forOrg(orgId)
      const result = await service.list({
        userId: user?.$id || '',
        departmentId,
        canManage,
        type,
        archived: archived === 'true',
        favorite: favorite === 'true' ? true : undefined,
        deleted: deleted === 'true',
        limit,
        page,
      })

      return response.ok({
        total: result.total,
        limit,
        page,
        lastPage: Math.ceil(result.total / limit),
        data: result.documents,
      })
    } catch (error: any) {
      if (error.message === 'User is not a member of this organisation') {
        return response.forbidden({ message: error.message })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/couriers/:id
   * Get a single courier.
   */
  async show({ user, params, response }: HttpContext) {
    try {
      const { canManage, departmentId } = await this.getUserContext(user, params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)

      // Permission Check: Manager OR Assigned User OR Assigned Department OR Creator
      const isAssignedUser = courier.assignments.some(
        (a) => a.entityId === user?.$id && a.entityType === 'user'
      )
      const isAssignedDept = departmentId
        ? courier.assignments.some(
            (a) => a.entityId === departmentId && a.entityType === 'department'
          )
        : false
      const isCreator = courier.createdBy === user?.$id

      if (!canManage && !isAssignedUser && !isAssignedDept && !isCreator) {
        return response.forbidden({ message: 'You do not have permission to view this courier' })
      }

      return response.ok({ data: courier })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/couriers
   * Create a new courier record.
   */
  async store({ user, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(createCourierValidator)

    if (payload.type === 'incoming' || payload.type === 'outgoing') {
      const hasExternalContact = Boolean(payload.externalContactId)
      const hasManualSender = Boolean(
        payload.senderName || payload.senderEmail || payload.senderPhone
      )

      if (!hasExternalContact && !hasManualSender) {
        return response.badRequest({
          errors: [
            {
              message:
                'Provide either an external contact or sender details (name, email, or phone) for incoming and outgoing couriers',
              field: 'senderName',
              rule: 'required',
            },
          ],
        })
      }
    }

    try {
      const service = await CourierService.forOrg(params.orgId)

      const courier = await service.create({
        type: payload.type,
        urgency: payload.urgency,
        subject: payload.subject,
        receivedAt: payload.receivedAt,
        emittedAt: payload.emittedAt,
        senderName: payload.senderName,
        senderEmail: payload.senderEmail,
        senderPhone: payload.senderPhone,
        externalContactId: payload.externalContactId,
        entityIds: payload.entityIds,
        targetType: payload.targetType,
        createdBy: user?.$id || '',
        fileIds: payload.fileIds,
      })

      // Emit assignment events for each assigned entity
      if (courier.assignments && courier.assignments.length > 0) {
        for (const assignment of courier.assignments) {
          emitter.emit(
            CourierAssigned,
            new CourierAssigned(
              params.orgId,
              courier.id,
              assignment.entityType,
              assignment.entityId
            )
          )
        }
      }

      return response.created({ message: 'Courier created successfully', data: courier })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/couriers/upload-url
   * Prepare direct Appwrite upload targets for courier documents.
   */
  async createUploadUrl({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(createCourierUploadUrlValidator)

    try {
      const service = await CourierService.forOrg(params.orgId)
      const uploads = service.createUploadTargets(payload.files)

      return response.ok({
        data: uploads,
      })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PATCH /api/v1/organisations/:orgId/couriers/:id
   * Update a courier record.
   */
  async update({ user, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(updateCourierValidator)

    try {
      const { canManage, departmentId } = await this.getUserContext(user, params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)

      // Permission Check: Manager OR Assigned User OR Assigned Department OR Creator
      const isAssignedUser = courier.assignments.some(
        (a) => a.entityId === user?.$id && a.entityType === 'user'
      )
      const isAssignedDept = departmentId
        ? courier.assignments.some(
            (a) => a.entityId === departmentId && a.entityType === 'department'
          )
        : false
      const isCreator = courier.createdBy === user?.$id

      if (!canManage && !isAssignedUser && !isAssignedDept && !isCreator) {
        return response.forbidden({ message: 'You do not have permission to update this courier' })
      }

      const updatedCourier = await service.update(params.id, payload)

      return response.ok({ data: updatedCourier })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/couriers/:id
   * Move a courier to the bin (soft delete).
   */
  async destroy({ user, params, response }: HttpContext) {
    try {
      const { canManage } = await this.getUserContext(user, params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)

      // Permission Check: Manager OR Creator
      const isCreator = courier.createdBy === user?.$id

      if (!canManage && !isCreator) {
        return response.forbidden({
          message: 'Only managers or the creator can delete this courier',
        })
      }

      await service.softDelete(params.id)
      return response.ok({ message: 'Courier moved to bin' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/couriers/:id/restore
   * Restore a courier from the bin.
   */
  async restore({ user, params, response }: HttpContext) {
    try {
      const { canManage, departmentId } = await this.getUserContext(user, params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)

      const isAssignedUser = courier.assignments.some(
        (a) => a.entityId === user?.$id && a.entityType === 'user'
      )
      const isAssignedDept = departmentId
        ? courier.assignments.some(
            (a) => a.entityId === departmentId && a.entityType === 'department'
          )
        : false
      const isCreator = courier.createdBy === user?.$id

      if (!canManage && !isAssignedUser && !isAssignedDept && !isCreator) {
        return response.forbidden({ message: 'You do not have permission to restore this courier' })
      }

      const restoredCourier = await service.restore(params.id)
      return response.ok({ data: restoredCourier, message: 'Courier restored successfully' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/couriers/:id/force
   * Permanently delete a courier.
   */
  async forceDestroy({ user, params, response }: HttpContext) {
    try {
      const { canManage } = await this.getUserContext(user, params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)

      // Permission Check: Manager OR Creator
      const isCreator = courier.createdBy === user?.$id

      if (!canManage && !isCreator) {
        return response.forbidden({
          message: 'Only managers or the creator can permanently delete this courier',
        })
      }

      await service.forceDelete(params.id)
      return response.ok({ message: 'Courier permanently deleted' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }
}
