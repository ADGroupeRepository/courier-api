import {
  CourierStatus,
  CourierType,
  CourierUrgency,
  CourierCustodyState,
} from '#modules/courier/courier_enums'
import vine from '@vinejs/vine'

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
    delivererName: vine.string().minLength(2).maxLength(255).trim().optional(),
    delivererEmail: vine.string().email().optional(),
    delivererPhone: vine.string().maxLength(255).trim().optional(),
    correspondentId: vine.string().maxLength(36).trim().optional(),
    targetType: vine.enum(['user', 'department']),
    entityIds: vine.array(vine.string().maxLength(36).trim()).minLength(1).maxLength(50),
    fileIds: vine.array(vine.string().maxLength(36).trim()).maxLength(20).optional(),
  })
)

/**
 * Validator for preparing direct courier document uploads.
 */
export const createCourierUploadUrlValidator = vine.create(
  vine.object({
    files: vine
      .array(
        vine.object({
          fileName: vine.string().trim().minLength(1).maxLength(255),
          fileExtension: vine.enum(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png']),
          size: vine
            .number()
            .positive()
            .max(25 * 1024 * 1024),
        })
      )
      .minLength(1)
      .maxLength(20),
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
    delivererName: vine.string().minLength(2).maxLength(255).trim().optional(),
    delivererEmail: vine.string().email().optional(),
    delivererPhone: vine.string().maxLength(255).trim().optional(),
    correspondentId: vine.string().maxLength(36).trim().optional(),
    status: vine.enum(CourierStatus).optional(),
    isFavorite: vine.boolean().optional(),
    isArchived: vine.boolean().optional(),
    currentCustody: vine.enum(CourierCustodyState).optional(),
    custodyUserId: vine.string().maxLength(36).trim().nullable().optional(),
    custodyDeptId: vine.string().maxLength(36).trim().nullable().optional(),
    requiresPickup: vine.boolean().optional(),
    signedProofFileId: vine.string().maxLength(36).trim().nullable().optional(),
    dispatchedAt: vine.string().nullable().optional(),
    dispatchedBy: vine.string().maxLength(36).trim().nullable().optional(),
    receivedBy: vine.string().maxLength(36).trim().nullable().optional(),
    handlerUserId: vine.string().maxLength(36).trim().nullable().optional(),
  })
)

export const createCourierReplyValidator = vine.create(
  vine.object({
    subject: vine.string().minLength(3).maxLength(255).trim(),
    emittedAt: vine.string().trim().optional(),
    fileIds: vine.array(vine.string().maxLength(36).trim()).optional(),
    delivererName: vine.string().maxLength(255).trim().optional(),
    delivererEmail: vine.string().email().maxLength(255).trim().optional(),
    delivererPhone: vine.string().maxLength(255).trim().optional(),
    ccUserIds: vine.array(vine.string().maxLength(36).trim()).optional(),
    note: vine.string().maxLength(2000).trim().optional(),
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
