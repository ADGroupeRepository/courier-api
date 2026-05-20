import type { HttpContext } from '@adonisjs/core/http'
import CourierReplyService from '#modules/courier/courier_reply_service'
import {
  createCourierReplyValidator,
  updateCourierReplyValidator,
} from '#modules/courier/courier_validator'
import appwrite from '#services/appwrite_service'
import emitter from '@adonisjs/core/services/emitter'
import CourierReplySent from '#events/courier_reply_sent'

export default class CourierRepliesController {
  /**
   * List replies for a courier
   */
  async index({ request, response, params }: HttpContext) {
    const orgId = request.header('x-org-id')
    if (!orgId) {
      return response.badRequest({ message: 'Missing x-org-id header' })
    }

    const { id: courierId } = params
    const qs = request.qs()

    try {
      const service = await CourierReplyService.forOrg(orgId)
      const replies = await service.list(courierId, {
        limit: qs.limit ? Number.parseInt(qs.limit, 10) : undefined,
        offset: qs.offset ? Number.parseInt(qs.offset, 10) : undefined,
      })

      return response.ok(replies)
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
  async store({ request, response, params }: HttpContext) {
    const orgId = request.header('x-org-id')
    if (!orgId) {
      return response.badRequest({ message: 'Missing x-org-id header' })
    }

    // Get the auth user from Appwrite using the bearer token
    const token = request.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return response.unauthorized({ message: 'Missing auth token' })
    }

    let userId: string
    try {
      const client = appwrite.createSessionClient(token)
      const user = await client.account.get()
      userId = user.$id
    } catch (error) {
      return response.unauthorized({ message: 'Invalid or expired token' })
    }

    const { id: courierId } = params

    // Validate request
    const payload = await request.validateUsing(createCourierReplyValidator)
    const file = request.file('file')

    try {
      const service = await CourierReplyService.forOrg(orgId)

      let fileOptions
      if (file && file.tmpPath && file.clientName) {
        fileOptions = {
          tmpPath: file.tmpPath,
          fileName: file.clientName,
        }
      }

      const reply = await service.create(
        {
          courierId,
          content: payload.content,
          createdBy: userId,
        },
        fileOptions
      )

      emitter.emit(CourierReplySent, new CourierReplySent(orgId, courierId, userId))

      return response.created(reply)
    } catch (error: any) {
      return response.internalServerError({
        message: 'Failed to create courier reply',
        error: error.message,
      })
    }
  }

  /**
   * Update a courier reply
   */
  async update({ request, response, params }: HttpContext) {
    const orgId = request.header('x-org-id')
    if (!orgId) {
      return response.badRequest({ message: 'Missing x-org-id header' })
    }

    const { replyId } = params

    // Validate request
    const payload = await request.validateUsing(updateCourierReplyValidator)

    try {
      const service = await CourierReplyService.forOrg(orgId)
      const reply = await service.update(replyId, payload)
      return response.ok(reply)
    } catch (error: any) {
      return response.internalServerError({
        message: 'Failed to update courier reply',
        error: error.message,
      })
    }
  }
}
