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
 * Validator for confirming email OTP verification.
 */
export const confirmEmailVerificationValidator = vine.create(
  vine.object({
    userId: vine.string().trim(),
    otp: vine.string().trim().minLength(6).maxLength(6),
  })
)

/**
 * Validator for requesting a password reset email.
 */
export const requestPasswordResetValidator = vine.create(
  vine.object({
    email: vine.string().email().normalizeEmail().trim(),
  })
)

/**
 * Validator for resetting the password using email and OTP.
 */
export const confirmPasswordResetValidator = vine.create(
  vine.object({
    email: vine.string().email().normalizeEmail().trim(),
    otp: vine.string().trim().minLength(6).maxLength(6),
    password: vine.string().minLength(8).maxLength(256),
  })
)
/**
 * Validator for updating the user profile.
 */
export const updateProfileValidator = vine.create(
  vine.object({
    name: vine.string().minLength(1).maxLength(128).trim().optional(),
    phone: vine.string().trim().optional(),
    avatar: vine.file({ size: '5mb', extnames: ['jpg', 'png', 'jpeg', 'webp'] }).optional(),
    signature: vine.file({ size: '5mb', extnames: ['jpg', 'png', 'jpeg', 'webp'] }).optional(),
  })
)

/**
 * Validator for registering a push/messaging target device token.
 */
export const registerPushTokenValidator = vine.create(
  vine.object({
    token: vine.string().minLength(1).trim(),
    providerType: vine.enum(['push', 'email', 'sms']).optional(),
    providerId: vine.string().trim().optional(),
    name: vine.string().trim().optional(),
  })
)
