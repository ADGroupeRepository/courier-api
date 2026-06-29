import type { HttpContext } from '@adonisjs/core/http'
import CourierReplyService from '#modules/courier/courier_reply_service'
import { createCourierReplyValidator } from '#modules/courier/courier_validator'
import emitter from '@adonisjs/core/services/emitter'
import CourierReplySent from '#events/courier_reply_sent'

export default class CourierRepliesController {
  /**
   * List replies for a courier
   */
  async index({ request, response, params }: HttpContext) {
    const orgId = params.orgId
    const { id: courierId } = params
    const qs = request.qs()

    try {
      const limit = qs.limit ? Number.parseInt(qs.limit, 10) : 25
      const page = qs.page ? Number.parseInt(qs.page, 10) : 1
      const service = await CourierReplyService.forOrg(orgId)
      const result = await service.list(courierId, {
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
      return response.internalServerError({
        message: 'Failed to fetch courier replies',
        error: error.message,
      })
    }
  }

  /**
   * Add a new reply to a courier
   */
  async store({ request, response, params, user }: HttpContext) {
    const orgId = params.orgId
    const { id: courierId } = params
    const userId = user?.$id

    if (!userId) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    // Validate request
    const payload = await request.validateUsing(createCourierReplyValidator)

    try {
      const service = await CourierReplyService.forOrg(orgId)

      const reply = await service.create({
        courierId,
        subject: payload.subject,
        emittedAt: payload.emittedAt,
        fileIds: payload.fileIds,
        delivererName: payload.delivererName,
        delivererEmail: payload.delivererEmail,
        delivererPhone: payload.delivererPhone,
        ccUserIds: payload.ccUserIds,
        note: payload.note,
        createdBy: userId,
      })

      // Log activity
      try {
        const { default: CourierService } = await import('#modules/courier/courier_service')
        const courierService = await CourierService.forOrg(orgId)
        await courierService.logActivity(
          courierId,
          'replied',
          userId,
          `Réponse ajoutée: ${payload.subject}`
        )
      } catch (logError) {
        // Non-blocking log error
      }

      emitter.emit(CourierReplySent, new CourierReplySent(orgId, courierId, userId))

      return response.created(reply)
    } catch (error: any) {
      return response.internalServerError({
        message: 'Failed to create courier reply',
        error: error.message,
      })
    }
  }
}
