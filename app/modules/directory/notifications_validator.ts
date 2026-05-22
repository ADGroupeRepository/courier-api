import vine from '@vinejs/vine'

/**
 * Validator for bulk deleting notifications.
 */
export const deleteNotificationsValidator = vine.create(
  vine.object({
    ids: vine.array(vine.string().maxLength(36).trim()).minLength(1),
  })
)
