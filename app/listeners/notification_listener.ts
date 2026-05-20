import type CourierAssigned from '#events/courier_assigned'
import type CourierMessageSent from '#events/courier_message_sent'
import type CourierReplySent from '#events/courier_reply_sent'
import NotificationService from '#services/notification_service'
import logger from '@adonisjs/core/services/logger'

/**
 * Listener to handle courier-related events and dispatch corresponding notifications.
 */
export default class NotificationListener {
  /**
   * Handles the event when a courier is assigned to a target entity (e.g., ticket, task).
   *
   * @param event - The CourierAssigned event payload.
   * @returns A promise that resolves when the notification dispatch attempt is complete.
   */
  async onCourierAssigned(event: CourierAssigned) {
    try {
      await NotificationService.notifyAssignment(
        event.orgId,
        event.courierId,
        event.targetType,
        event.targetId
      )
    } catch (err: any) {
      logger.error({ err, event }, 'Error handling CourierAssigned event')
    }
  }

  /**
   * Handles the event when a new message is sent by a courier.
   *
   * @param event - The CourierMessageSent event payload.
   * @returns A promise that resolves when the notification dispatch attempt is complete.
   */
  async onCourierMessageSent(event: CourierMessageSent) {
    try {
      await NotificationService.notifyNewMessageOrReply(
        event.orgId,
        event.courierId,
        event.senderId,
        'message'
      )
    } catch (err: any) {
      logger.error({ err, event }, 'Error handling CourierMessageSent event')
    }
  }

  /**
   * Handles the event when a reply is sent to a courier message.
   *
   * @param event - The CourierReplySent event payload.
   * @returns A promise that resolves when the notification dispatch attempt is complete.
   */
  async onCourierReplySent(event: CourierReplySent) {
    try {
      await NotificationService.notifyNewMessageOrReply(
        event.orgId,
        event.courierId,
        event.senderId,
        'reply'
      )
    } catch (err: any) {
      logger.error({ err, event }, 'Error handling CourierReplySent event')
    }
  }
}
