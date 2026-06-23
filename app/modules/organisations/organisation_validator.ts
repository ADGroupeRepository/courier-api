import vine from '@vinejs/vine'

/**
 * Validator for creating an organisation.
 */
export const createOrganisationValidator = vine.create(
  vine.object({
    name: vine.string().minLength(1).maxLength(128).trim(),
    description: vine.string().maxLength(500).trim().optional(),
    address: vine.string().maxLength(256).trim().optional(),
    rccm: vine.string().maxLength(128).trim().optional(),
  })
)

/**
 * Validator for updating an organisation.
 */
export const updateOrganisationValidator = vine.create(
  vine.object({
    name: vine.string().minLength(1).maxLength(128).trim().optional(),
    description: vine.string().maxLength(500).trim().optional(),
    address: vine.string().maxLength(256).trim().optional(),
    rccm: vine.string().maxLength(128).trim().optional(),
  })
)

/**
 * Validator for adding a member to an organisation.
 */
export const addMemberValidator = vine.create(
  vine.object({
    email: vine.string().email().normalizeEmail().trim(),
    role: vine.enum(['admin', 'user']),
  })
)

/**
 * Validator for updating a member's roles.
 */
export const updateMemberValidator = vine.create(
  vine.object({
    role: vine.enum(['admin', 'user']),
  })
)
