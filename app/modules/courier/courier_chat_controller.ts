import type { HttpContext } from '@adonisjs/core/http'
import CourierChatService from '#modules/courier/courier_chat_service'
import { createCourierMessageValidator } from '#modules/courier/courier_validator'
import emitter from '@adonisjs/core/services/emitter'
import CourierMessageSent from '#events/courier_message_sent'

export default class CourierChatController {
  /**
   * Add a new chat message to a courier
   */
  async store({ request, response, params, user }: HttpContext) {
    const orgId = params.orgId
    const userId = user?.$id
    if (!userId) {
      return response.unauthorized({ message: 'Authentication required' })
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
