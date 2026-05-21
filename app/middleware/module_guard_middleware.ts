import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import appwrite from '#services/appwrite_service'
import { MODULE_REGISTRY } from '#modules/_registry/module_registry'
import PlanService from '#modules/plans/plan_service'
import locks from '@adonisjs/lock/services/main'

/**
 * Middleware to guard routes that belong to a specific module.
 * It checks if the organisation has activated the requested module.
 * If not activated, it attempts to auto-provision the module if the plan allows it.
 *
 * Usage:
 * router.get('...', [...]).use(middleware.moduleGuard('invoicing'))
 */
export default class ModuleGuardMiddleware {
  async handle(ctx: HttpContext, next: NextFn, moduleName: string) {
    // 1. Get orgId from route params
    const orgId = ctx.request.param('orgId')
    if (!orgId) {
      return ctx.response.badRequest({ message: 'Missing orgId in route parameters' })
    }

    // 2. Verify the module exists in the registry
    if (!MODULE_REGISTRY.has(moduleName)) {
      return ctx.response.internalServerError({
        message: `Module "${moduleName}" is not registered in the system`,
      })
    }

    // 3. Authenticate the user
    const userId = ctx.user?.$id
    if (!userId) {
      return ctx.response.unauthorized({ message: 'Authentication required' })
    }

    try {
      // 4. Fetch subscription details and verify status
      const subInfo = await PlanService.getOrgSubscriptionInfo(orgId)

      if (subInfo.status === 'none') {
        return ctx.response.forbidden({
          message:
            'No active subscription found for this organisation. Please contact an administrator.',
          code: 'NO_SUBSCRIPTION',
        })
      }

      if (subInfo.status === 'pending') {
        return ctx.response.forbidden({
          message:
            'Your subscription is pending admin approval. Please wait for an administrator to activate it.',
          code: 'SUBSCRIPTION_PENDING',
        })
      }

      if (subInfo.status === 'rejected') {
        return ctx.response.forbidden({
          message:
            'Your subscription has been rejected by an administrator. Please contact support.',
          code: 'SUBSCRIPTION_REJECTED',
        })
      }

      if (subInfo.status === 'expired') {
        return ctx.response.forbidden({
          message:
            "Your organisation's subscription has expired. Please renew to continue using this feature.",
          code: 'SUBSCRIPTION_EXPIRED',
        })
      }

      // If in grace period, attach a warning header so the frontend can show a banner
      if (subInfo.status === 'grace_period') {
        ctx.response.header('X-Subscription-Warning', 'grace_period')
        ctx.response.header('X-Grace-Days-Remaining', String(subInfo.daysInGrace ?? 0))
      }

      // 5. Verify the user has a valid active seat license in the organisation
      const userLicense = await PlanService.getUserLicense(orgId, userId)
      if (!userLicense) {
        return ctx.response.forbidden({
          message:
            'You do not have an active seat license in this organisation. Please contact the owner.',
          code: 'NO_LICENSE',
        })
      }

      // 6. Get the organisation preferences to check active modules
      // Use the sessionClient if it exists (so it respects user permissions to read team prefs),
      // or fallback to admin client if not explicitly required. We prefer admin client here
      // because not all users might have permission to read `prefs` directly,
      // but they should still be able to access the module if it's active for the org.
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      const activeModules: string[] = prefs.modules || []

      if (activeModules.includes(moduleName)) {
        return next()
      }

      // 7. Module is not activated. Attempt auto-provisioning with a lock to avoid race conditions.
      const lockKey = `org_provision:${orgId}`
      const lock = locks.createLock(lockKey, '30s')

      const [executed, result] = await lock.run(async () => {
        // Re-read team prefs inside the lock to ensure we have the most fresh state
        const freshPrefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
        const freshActive: string[] = freshPrefs.modules || []

        if (freshActive.includes(moduleName)) {
          return { success: true }
        }

        // Check if the plan allows this module
        const allowed: string[] = subInfo.plan?.allowedModules || []
        const isAllowed = allowed.includes(moduleName) || allowed.includes('*')

        if (!isAllowed) {
          return {
            success: false,
            status: 403,
            message: `Your current plan does not include access to the "${moduleName}" module. Please upgrade your plan.`,
            code: 'PLAN_LIMIT_REACHED',
          }
        }

        // Check maxModules limit if defined
        const maxModules = subInfo.plan?.maxModules
        if (maxModules !== undefined && maxModules !== -1 && freshActive.length >= maxModules) {
          return {
            success: false,
            status: 403,
            message: `Module "${moduleName}" cannot be activated. You have reached the limit of ${maxModules} active modules for your current plan. Please upgrade your plan.`,
            code: 'PLAN_LIMIT_REACHED',
          }
        }

        // Add module to the team preferences
        const updatedModules = [...freshActive, moduleName]
        await appwrite.teams.updatePrefs({
          teamId: orgId,
          prefs: {
            ...freshPrefs,
            modules: updatedModules,
          },
        })

        return { success: true }
      })

      if (!executed) {
        return ctx.response.conflict({
          message: 'Another module activation is currently in progress. Please try again.',
        })
      }

      if (result && !result.success) {
        return ctx.response.status(result.status || 403).send({
          message: result.message,
          code: result.code,
        })
      }
    } catch (error: any) {
      if (error.code === 404) {
        return ctx.response.notFound({ message: 'Organisation not found' })
      }
      return ctx.response.internalServerError({
        message: 'Error verifying or activating module access',
        error: error.message,
      })
    }

    // Proceed to the controller
    return next()
  }
}
