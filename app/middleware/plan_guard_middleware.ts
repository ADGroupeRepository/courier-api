import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import PlanService from '#modules/plans/plan_service'

/**
 * Middleware to gate features and resources based on the org's active plan.
 *
 * Usage in routes:
 *   .use(middleware.planGuard('feature:notifications.push'))
 *   .use(middleware.planGuard('module:invoicing'))
 *   .use(middleware.planGuard('limit:maxMembers'))
 *   .use(middleware.planGuard('limit:maxCouriersPerMonth'))
 *
 * The guard string format is: `<type>:<key>`
 *   - `feature:<name>` — checks plan.features includes the name
 *   - `module:<name>` — checks plan.allowedModules includes the name
 *   - `limit:<key>`   — checks the numeric limit hasn't been exceeded
 *     (for limits, the guard only verifies the license is active;
 *      actual count enforcement should happen in the service layer)
 *
 * Requires `orgId` to be present in route params.
 */
export default class PlanGuardMiddleware {
  async handle(ctx: HttpContext, next: NextFn, guardString: string) {
    const orgId = ctx.request.param('orgId')

    if (!orgId) {
      return ctx.response.badRequest({
        message: 'Missing orgId in route parameters. PlanGuard requires an org context.',
      })
    }

    // Parse guard string: "feature:xxx", "module:xxx", or "limit:xxx"
    const [guardType, guardKey] = guardString.split(':')

    if (!guardType || !guardKey) {
      return ctx.response.internalServerError({
        message: `Invalid planGuard format: "${guardString}". Expected "feature:<name>", "module:<name>", or "limit:<key>".`,
      })
    }

    try {
      const subInfo = await PlanService.getOrgSubscriptionInfo(orgId)

      // No subscription at all
      if (subInfo.status === 'none') {
        return ctx.response.forbidden({
          message:
            'No active subscription found for this organisation. Please contact an administrator.',
          code: 'NO_SUBSCRIPTION',
        })
      }

      // Expired beyond grace period
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

      // Perform the specific guard check
      let allowed = true
      const userId = ctx.user?.$id

      switch (guardType) {
        case 'feature':
          if (!userId) return ctx.response.unauthorized({ message: 'User must be authenticated for feature checks.' })
          allowed = await PlanService.checkUserFeature(orgId, userId, guardKey)
          break

        case 'module':
          if (!userId) return ctx.response.unauthorized({ message: 'User must be authenticated for module checks.' })
          allowed = await PlanService.checkUserModule(orgId, userId, guardKey)
          break

        case 'limit':
          allowed = true
          break

        default:
          return ctx.response.internalServerError({
            message: `Unknown planGuard type: "${guardType}". Expected "feature", "module", or "limit".`,
          })
      }

      if (!allowed) {
        return ctx.response.forbidden({
          message: `Your current plan does not include access to "${guardKey}". Please upgrade your plan.`,
          code: 'PLAN_LIMIT_REACHED',
          guardType,
          guardKey,
        })
      }

      return next()
    } catch (error: any) {
      console.error('[PlanGuardMiddleware] Error:', error.message)
      // If we can't verify the license, allow through but log the error.
      // This prevents license checking failures from blocking the entire application.
      return next()
    }
  }
}
