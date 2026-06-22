import vine from '@vinejs/vine'
import {
  CourierUrgency,
  CourierStatus,
  CourierType,
  CourierStructureType,
  DocumentStatus,
} from '#modules/courier/courier_enums'

/**
 * Validator for creating a new courier.
 *
 * `targetType` determines whether `entityIds` refer to users or departments.
 * A courier targets either users OR departments, never both.
 */
export const createCourierValidator = vine.create(
  vine.object({
    type: vine.enum(CourierType),
    urgency: vine.enum(CourierUrgency),
    subject: vine.string().minLength(3).maxLength(255).trim(),
    receivedAt: vine.string().optional(),
    emittedAt: vine.string().optional(),
    senderName: vine.string().minLength(2).maxLength(255).trim().optional(),
    senderEmail: vine.string().email().optional(),
    senderPhone: vine.string().maxLength(255).trim().optional(),
    externalContactId: vine.string().maxLength(36).trim().optional(),
    externalContactType: vine.enum(CourierStructureType).optional(),
    targetType: vine.enum(['user', 'department']),
    entityIds: vine.array(vine.string().maxLength(36).trim()).minLength(1).maxLength(50),
    file: vine
      .file({
        size: '10mb',
        extnames: ['jpg', 'png', 'pdf', 'docx', 'doc'],
      })
      .optional(),
  })
)

/**
 * Validator for updating a courier.
 */
export const updateCourierValidator = vine.create(
  vine.object({
    urgency: vine.enum(CourierUrgency).optional(),
    subject: vine.string().minLength(3).maxLength(255).trim().optional(),
    receivedAt: vine.string().optional(),
    emittedAt: vine.string().optional(),
    senderName: vine.string().minLength(2).maxLength(255).trim().optional(),
    senderEmail: vine.string().email().optional(),
    senderPhone: vine.string().maxLength(255).trim().optional(),
    externalContactId: vine.string().maxLength(36).trim().optional(),
    externalContactType: vine.enum(CourierStructureType).optional(),
    status: vine.enum(CourierStatus).optional(),
    isFavorite: vine.boolean().optional(),
    isArchived: vine.boolean().optional(),
  })
)

/**
 * Validator for creating a courier reply.
 */
export const createCourierReplyValidator = vine.create(
  vine.object({
    content: vine.string().maxLength(10000).trim(),
    file: vine
      .file({
        size: '10mb',
        extnames: ['jpg', 'png', 'pdf', 'docx', 'doc'],
      })
      .optional(),
  })
)

/**
 * Validator for updating a courier reply.
 */
export const updateCourierReplyValidator = vine.create(
  vine.object({
    documentStatus: vine.enum(DocumentStatus).optional(),
  })
)

/**
 * Validator for creating a courier chat message.
 */
export const createCourierMessageValidator = vine.create(
  vine.object({
    content: vine.string().maxLength(5000).trim(),
    file: vine
      .file({
        size: '10mb',
        extnames: ['jpg', 'png', 'pdf', 'docx', 'doc'],
      })
      .optional(),
  })
)
