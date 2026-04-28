import vine from '@vinejs/vine'

/**
 * Validator for creating a new courier.
 */
export const createCourierValidator = vine.create(
  vine.object({
    type: vine.enum(['incoming', 'outgoing']),
    subject: vine.string().minLength(3).maxLength(255).trim(),
    sender: vine.string().minLength(2).maxLength(255).trim().optional(),
    recipient: vine.string().minLength(2).maxLength(255).trim().optional(),
    assignedTo: vine.string().maxLength(36).trim(),
    targetType: vine.enum(['user', 'department']),
    file: vine.file({
      size: '25mb',
      extnames: ['jpg', 'png', 'pdf', 'docx', 'doc'],
    }).optional(),
  })
)

/**
 * Validator for updating a courier.
 */
export const updateCourierValidator = vine.create(
  vine.object({
    subject: vine.string().minLength(3).maxLength(255).trim().optional(),
    sender: vine.string().minLength(2).maxLength(255).trim().optional(),
    assignedTo: vine.string().maxLength(36).trim().optional(),
    status: vine.enum(['pending', 'received', 'assigned', 'completed']).optional(),
  })
)
