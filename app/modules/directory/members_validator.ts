import vine from '@vinejs/vine'

/**
 * Validator for assigning a member to a department.
 */
export const assignMemberValidator = vine.create(
  vine.object({
    userId: vine.string(), // Passed in body
    departmentId: vine.string(), // Passed in body
    jobTitle: vine.string().optional(),
    departmentRole: vine.enum(['manager', 'member']).optional(),
  })
)

/**
 * Validator for listing members in a department.
 */
export const listMembersValidator = vine.create(
  vine.object({
    organisationId: vine.string(),
    departmentId: vine.string(),
  })
)
