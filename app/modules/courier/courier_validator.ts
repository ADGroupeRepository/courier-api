import vine from '@vinejs/vine'
import { CourierUrgency, CourierStatus, CourierType, CourierStructureType } from '#modules/courier/courier_enums'

/**
 * Validator for creating a new courier.
 */
export const createCourierValidator = vine.create(
  vine.object({
    type: vine.enum(CourierType),
    urgency: vine.enum(CourierUrgency),
    subject: vine.string().minLength(3).maxLength(255).trim(),
    contactName: vine.string().minLength(2).maxLength(255).trim(),
    contactNumber: vine.string().maxLength(255).trim(),
    contactStructureType: vine.enum(CourierStructureType).optional(),
    contactStructureName: vine.string().maxLength(255).trim().optional(),
    contactIdNumber: vine.string().maxLength(255).trim().optional(),
    contactPhone: vine.string().maxLength(255).trim().optional(),
    contactEmail: vine.string().email().optional(),
    externalContactId: vine.string().maxLength(36).trim().optional(),
    internalEntityId: vine.string().maxLength(36).trim(),
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
    urgency: vine.enum(CourierUrgency).optional(),
    subject: vine.string().minLength(3).maxLength(255).trim().optional(),
    contactName: vine.string().minLength(2).maxLength(255).trim().optional(),
    contactNumber: vine.string().maxLength(255).trim().optional(),
    contactStructureType: vine.enum(CourierStructureType).optional(),
    contactStructureName: vine.string().maxLength(255).trim().optional(),
    contactIdNumber: vine.string().maxLength(255).trim().optional(),
    contactPhone: vine.string().maxLength(255).trim().optional(),
    contactEmail: vine.string().email().optional(),
    externalContactId: vine.string().maxLength(36).trim().optional(),
    internalEntityId: vine.string().maxLength(36).trim().optional(),
    targetType: vine.enum(['user', 'department']).optional(),
    status: vine.enum(CourierStatus).optional(),
    isFavorite: vine.boolean().optional(),
    isArchived: vine.boolean().optional(),
  })
)
