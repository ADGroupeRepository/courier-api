import vine from '@vinejs/vine'

/**
 * Validator for creating a new plan (admin only).
 */
export const createPlanValidator = vine.create(
  vine.object({
    name: vine.string().minLength(2).maxLength(100).trim(),
    slug: vine
      .string()
      .minLength(2)
      .maxLength(50)
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: vine.string().maxLength(500).trim().optional(),
    price: vine.number().min(0),

    maxMembers: vine.number().min(-1),
    maxStorageMB: vine.number().min(-1),
    maxCouriersPerMonth: vine.number().min(-1),
    maxModules: vine.number().min(-1),
    allowedModules: vine.array(vine.string().maxLength(36).trim()),
    features: vine.array(vine.string().maxLength(100).trim()),
    isActive: vine.boolean().optional(),
    sortOrder: vine.number().optional(),
  })
)

/**
 * Validator for updating a plan (admin only).
 */
export const updatePlanValidator = vine.create(
  vine.object({
    name: vine.string().minLength(2).maxLength(100).trim().optional(),
    slug: vine
      .string()
      .minLength(2)
      .maxLength(50)
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    description: vine.string().maxLength(500).trim().optional(),
    price: vine.number().min(0).optional(),

    maxMembers: vine.number().min(-1).optional(),
    maxStorageMB: vine.number().min(-1).optional(),
    maxCouriersPerMonth: vine.number().min(-1).optional(),
    maxModules: vine.number().min(-1).optional(),
    allowedModules: vine.array(vine.string().maxLength(36).trim()).optional(),
    features: vine.array(vine.string().maxLength(100).trim()).optional(),
    isActive: vine.boolean().optional(),
    sortOrder: vine.number().optional(),
  })
)

/**
 * Validator for issuing a subscription to an org (admin only).
 */
export const issueSubscriptionValidator = vine.create(
  vine.object({
    planId: vine.string().maxLength(36).trim(),
    orgId: vine.string().maxLength(36).trim(),
    totalSeatsPurchased: vine.number().min(1),
    expiresAt: vine.string().optional(), // ISO 8601 datetime string
    notes: vine.string().maxLength(500).trim().optional(),
  })
)

/**
 * Validator for updating a subscription (admin only).
 */
export const updateSubscriptionValidator = vine.create(
  vine.object({
    isActive: vine.boolean().optional(),
    totalSeatsPurchased: vine.number().min(1).optional(),
    expiresAt: vine.string().optional(), // ISO 8601 datetime string
    notes: vine.string().maxLength(500).trim().optional(),
  })
)

/**
 * Validator for assigning a seat license to a user (org admin only).
 */
export const assignLicenseValidator = vine.create(
  vine.object({
    userId: vine.string().maxLength(36).trim(),
  })
)

/**
 * Validator for a user subscribing to a plan.
 */
export const subscribeToPlanValidator = vine.create(
  vine.object({
    planId: vine.string().maxLength(36).trim(),
  })
)
