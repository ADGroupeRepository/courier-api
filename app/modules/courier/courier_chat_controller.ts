import type { HttpContext } from '@adonisjs/core/http'
import CourierChatService from '#modules/courier/courier_chat_service'
import { createCourierMessageValidator } from '#modules/courier/courier_validator'
import appwrite from '#services/appwrite_service'
import emitter from '@adonisjs/core/services/emitter'
import CourierMessageSent from '#events/courier_message_sent'

export default class CourierChatController {
  /**
   * List chat messages for a courier
   */
  async index({ request, response, params }: HttpContext) {
    const orgId = request.header('x-org-id')
    if (!orgId) {
      return response.badRequest({ message: 'Missing x-org-id header' })
    }

    const { id: courierId } = params
    const qs = request.qs()

    try {
      const service = await CourierChatService.forOrg(orgId)
      const messages = await service.list(courierId, {
        limit: qs.limit ? Number.parseInt(qs.limit, 10) : undefined,
        offset: qs.offset ? Number.parseInt(qs.offset, 10) : undefined,
      })

      return response.ok(messages)
    } catch (error: any) {
      return response.internalServerError({
        message: 'Failed to fetch courier messages',
        error: error.message,
      })
    }
  }

  /**
   * Add a new chat message to a courier
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
    const payload = await request.validateUsing(createCourierMessageValidator)
    const file = request.file('file')

    try {
      const service = await CourierChatService.forOrg(orgId)

      let fileOptions
      if (file && file.tmpPath && file.clientName) {
        fileOptions = {
          tmpPath: file.tmpPath,
          fileName: file.clientName,
        }
      }

      const message = await service.create(
        {
          courierId,
          content: payload.content,
          createdBy: userId,
        },
        fileOptions
      )

      emitter.emit(CourierMessageSent, new CourierMessageSent(orgId, courierId, userId))

      return response.created(message)
    } catch (error: any) {
      return response.internalServerError({
        message: 'Failed to create chat message',
        error: error.message,
      })
    }
  }
}
