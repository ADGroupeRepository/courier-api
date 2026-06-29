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
   * Helper to get user's department ID in an organisation.
   */
  private async getDepartmentId(userId: string, orgId: string) {
    const memberService = await MembersService.forOrg(orgId)
    const profiles = await appwrite.databases.listDocuments({
      databaseId: memberService.databaseId,
      collectionId: Collections.ORG_PROFILES,
      queries: [Query.equal('userId', userId)],
    })
    return profiles.documents[0]?.departmentId
  }

  /**
   * GET /api/v1/organisations/:orgId/couriers
   * List all couriers for the organisation.
   */
  async index({ user, params, request, response, isOrgAdmin }: HttpContext) {
    const orgId = params.orgId
    const type = request.input('type') as CourierType | undefined
    const archived = request.input('archived') as string | undefined
    const favorite = request.input('favorite') as string | undefined
    const deleted = request.input('deleted') as string | undefined
    const limit = Number(request.input('limit')) || 25
    const page = Number(request.input('page')) || 1

    try {
      const departmentId = await this.getDepartmentId(user?.$id || '', orgId)

      // List couriers with visibility rules
      const service = await CourierService.forOrg(orgId)
      const result = await service.list({
        userId: user?.$id || '',
        departmentId,
        canManage: !!isOrgAdmin,
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
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/couriers/:id
   * Get a single courier.
   */
  async show({ user, params, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    try {
      const departmentId = await this.getDepartmentId(user?.$id || '', params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id, user?.$id)

      // Permission Check: Manager OR Secretariat OR Assigned User OR Assigned Department OR Creator
      const isAssignedUser = courier.assignments.some(
        (a) => a.entityId === user?.$id && a.entityType === 'user'
      )
      const isAssignedDept = departmentId
        ? courier.assignments.some(
            (a) => a.entityId === departmentId && a.entityType === 'department'
          )
        : false
      const isCreator = courier.createdBy?.id === user?.$id

      if (!isOrgAdmin && !isOrgSecretariat && !isAssignedUser && !isAssignedDept && !isCreator) {
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
  async store({ user, params, request, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    const payload = await request.validateUsing(createCourierValidator)

    if (payload.type === 'incoming' || payload.type === 'outgoing') {
      if (!payload.correspondentId) {
        return response.badRequest({
          errors: [
            {
              message:
                'Provide a correspondent (registered contact) for incoming and outgoing couriers',
              field: 'correspondentId',
              rule: 'required',
            },
          ],
        })
      }
    }

    try {
      if (payload.type === 'incoming') {
        const isAuthorized = isOrgAdmin || isOrgSecretariat
        if (!isAuthorized) {
          return response.forbidden({
            message: 'Only secretariat or administrators can register incoming couriers',
          })
        }
      }

      const service = await CourierService.forOrg(params.orgId)

      const courier = await service.create({
        type: payload.type,
        urgency: payload.urgency,
        subject: payload.subject,
        receivedAt: payload.receivedAt,
        emittedAt: payload.emittedAt,
        delivererName: payload.delivererName,
        delivererEmail: payload.delivererEmail,
        delivererPhone: payload.delivererPhone,
        correspondentId: payload.correspondentId,
        entityIds: payload.entityIds,
        targetType: payload.targetType,
        createdBy: user?.$id || '',
        fileIds: payload.fileIds,
      })

      // Log activity
      await service.logActivity(
        courier.id,
        'created',
        user?.$id || '',
        `Courrier créé: ${payload.subject}`
      )

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
  async update({ user, params, request, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    const payload = await request.validateUsing(updateCourierValidator)

    try {
      const departmentId = await this.getDepartmentId(user?.$id || '', params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id, user?.$id)

      // Permission Check: Manager OR Secretariat OR Assigned User OR Assigned Department OR Creator
      const isAssignedUser = courier.assignments.some(
        (a) => a.entityId === user?.$id && a.entityType === 'user'
      )
      const isAssignedDept = departmentId
        ? courier.assignments.some(
            (a) => a.entityId === departmentId && a.entityType === 'department'
          )
        : false
      const isCreator = courier.createdBy?.id === user?.$id

      if (!isOrgAdmin && !isOrgSecretariat && !isAssignedUser && !isAssignedDept && !isCreator) {
        return response.forbidden({ message: 'You do not have permission to update this courier' })
      }

      const updatedCourier = await service.update(params.id, payload)

      // Log activity depending on payload changes
      let action: any = 'updated'
      let detail = 'Courrier mis à jour'

      if (payload.isArchived === true) {
        action = 'archived'
        detail = 'Courrier archivé'
      } else if (payload.isArchived === false) {
        action = 'restored'
        detail = 'Courrier restauré'
      } else if (payload.isFavorite !== undefined) {
        action = 'updated'
        detail = payload.isFavorite
          ? 'Courrier ajouté aux favoris'
          : 'Courrier retiré des favoris'
      } else if (payload.status !== undefined) {
        action = 'status_changed'
        detail = `Statut modifié: ${payload.status}`
      } else if (payload.handlerUserId !== undefined) {
        action = 'handler_assigned'
        detail = 'Responsable assigné'
      }

      await service.logActivity(params.id, action, user?.$id || '', detail)

      return response.ok({ data: updatedCourier })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/couriers/:id/impute
   * Assign a handler (imputer) to a courier.
   */
  async impute({ user, params, request, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    const handlerUserId = request.input('handlerUserId')
    if (!handlerUserId) {
      return response.badRequest({ message: 'handlerUserId is required' })
    }

    try {
      const departmentId = await this.getDepartmentId(user?.$id || '', params.orgId)
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id, user?.$id)

      // Permission Check: Manager OR Secretariat OR Assigned User OR Assigned Department OR Creator
      const isAssignedUser = courier.assignments.some(
        (a) => a.entityId === user?.$id && a.entityType === 'user'
      )
      const isAssignedDept = departmentId
        ? courier.assignments.some(
            (a) => a.entityId === departmentId && a.entityType === 'department'
          )
        : false
      const isCreator = courier.createdBy?.id === user?.$id

      if (!isOrgAdmin && !isOrgSecretariat && !isAssignedUser && !isAssignedDept && !isCreator) {
        return response.forbidden({ message: 'You do not have permission to impute this courier' })
      }

      const updatedCourier = await service.update(params.id, { handlerUserId })
      await service.logActivity(params.id, 'handler_assigned', user?.$id || '', 'Responsable assigné')
      return response.ok({ data: updatedCourier, message: 'Responsable assigne avec succes' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/couriers/:id
   * Move a courier to the bin (soft delete).
   */
  async destroy({ user, params, response, isOrgAdmin }: HttpContext) {
    try {
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)

      // Permission Check: Manager OR Creator
      const isCreator = courier.createdBy?.id === user?.$id

      if (!isOrgAdmin && !isCreator) {
        return response.forbidden({
          message: 'Only managers or the creator can delete this courier',
        })
      }

      await service.softDelete(params.id)
      await service.logActivity(params.id, 'deleted', user?.$id || '', 'Courrier supprimé (corbeille)')
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
  async restore({ user, params, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    try {
      const departmentId = await this.getDepartmentId(user?.$id || '', params.orgId)
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
      const isCreator = courier.createdBy?.id === user?.$id

      if (!isOrgAdmin && !isOrgSecretariat && !isAssignedUser && !isAssignedDept && !isCreator) {
        return response.forbidden({ message: 'You do not have permission to restore this courier' })
      }

      const restoredCourier = await service.restore(params.id)
      await service.logActivity(params.id, 'restored', user?.$id || '', 'Courrier restauré')
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
  async forceDestroy({ user, params, response, isOrgAdmin }: HttpContext) {
    try {
      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.get(params.id)

      // Permission Check: Manager OR Creator
      const isCreator = courier.createdBy?.id === user?.$id

      if (!isOrgAdmin && !isCreator) {
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

  /**
   * POST /api/v1/organisations/:orgId/couriers/:id/pickup
   * Register physical pickup of courier by courier service (secretariat).
   */
  async pickup({ user, params, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    try {
      const isAuthorized = isOrgAdmin || isOrgSecretariat

      if (!isAuthorized) {
        return response.forbidden({
          message: 'Only secretariat members or administrators can perform pickup',
        })
      }

      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.pickup(params.id, user?.$id || '')

      await service.logActivity(
        params.id,
        'picked_up',
        user?.$id || '',
        'Courrier récupéré par le service courrier'
      )

      return response.ok({ data: courier, message: 'Courier picked up successfully' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/couriers/:id/handover
   * Hand over a courier physically to recipient.
   */
  async handover({ user, params, request, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    try {
      const isAuthorized = isOrgAdmin || isOrgSecretariat

      if (!isAuthorized) {
        return response.forbidden({
          message: 'Only secretariat members or administrators can perform handover',
        })
      }

      const recipientUserId = request.input('recipientUserId')
      const recipientDeptId = request.input('recipientDeptId')

      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.handover(params.id, recipientUserId, recipientDeptId)

      await service.logActivity(
        params.id,
        'handed_over',
        user?.$id || '',
        'Courrier remis au destinataire'
      )

      return response.ok({ data: courier, message: 'Courier handed over successfully' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/couriers/:id/dispatch
   * Dispatch an outgoing courier externally.
   */
  async dispatch({ user, params, request, response, isOrgAdmin, isOrgSecretariat }: HttpContext) {
    try {
      const isAuthorized = isOrgAdmin || isOrgSecretariat

      if (!isAuthorized) {
        return response.forbidden({
          message: 'Only secretariat members or administrators can dispatch couriers',
        })
      }

      const signedProofFileId = request.input('signedProofFileId')
      if (!signedProofFileId) {
        return response.badRequest({ message: 'signedProofFileId is required for dispatching' })
      }

      const service = await CourierService.forOrg(params.orgId)
      const courier = await service.dispatch(params.id, user?.$id || '', signedProofFileId)

      await service.logActivity(params.id, 'dispatched', user?.$id || '', 'Courrier expédié')

      return response.ok({ data: courier, message: 'Courier dispatched successfully' })
    } catch (error: any) {
      if (error.code === 404) return response.notFound({ message: 'Courier not found' })
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/couriers/:id/activities
   * List activities for a courier.
   */
  async activities({ params, request, response }: HttpContext) {
    const limit = Number(request.input('limit')) || 25
    const page = Number(request.input('page')) || 1

    try {
      const service = await CourierService.forOrg(params.orgId)
      const result = await service.listActivities(params.id, { limit, page })
      return response.ok({
        total: result.total,
        limit,
        page,
        lastPage: Math.ceil(result.total / limit),
        data: result.documents,
      })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }
}
