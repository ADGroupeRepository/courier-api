import vine from '@vinejs/vine'

/**
 * Validator for creating a new department.
 */
export const createDepartmentValidator = vine.create(
  vine.object({
    name: vine.string().minLength(1).maxLength(100).trim(),
    description: vine.string().maxLength(500).trim().optional(),
    managerUserId: vine.string().maxLength(36).trim().optional(),
    organisationId: vine.string().maxLength(36).trim(),
  })
)

/**
 * Validator for updating a department.
 */
export const updateDepartmentValidator = vine.create(
  vine.object({
    name: vine.string().minLength(1).maxLength(100).trim().optional(),
    description: vine.string().maxLength(500).trim().optional(),
    managerUserId: vine.string().maxLength(36).trim().optional(),
    organisationId: vine.string().maxLength(36).trim(),
  })
)
