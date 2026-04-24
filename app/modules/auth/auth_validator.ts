import vine from '@vinejs/vine'

/**
 * Validator for user registration.
 */
export const signupValidator = vine.create(
  vine.object({
    name: vine.string().minLength(1).maxLength(128).trim(),
    email: vine.string().email().normalizeEmail().trim(),
    phone: vine.string().trim().optional(),
    password: vine.string().minLength(8).maxLength(256),
  })
)

/**
 * Validator for user login.
 */
export const loginValidator = vine.create(
  vine.object({
    email: vine.string().email().normalizeEmail().trim(),
    password: vine.string().minLength(1),
  })
)
