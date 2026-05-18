import type { HttpContext } from '@adonisjs/core/http'
import PlanService from '#modules/plans/plan_service'

/**
 * PlansController — Public plan listing and org-scoped license/usage endpoints.
 *
 * Public routes:
 *   GET /api/v1/plans         → List all active plans
 *   GET /api/v1/plans/:planId → Get a single plan
 *
 * Org-scoped routes:
 *   GET /api/v1/organisations/:orgId/license → Get org license + plan + usage
 */
export default class PlansController {
  /**
   * GET /api/v1/plans
   * List all active plans. Available to any authenticated user.
   */
  async index({ response }: HttpContext) {
    try {
      const plans = await PlanService.listActivePlans()
      return response.ok({ data: plans })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/plans/:planId
   * Get details for a specific plan.
   */
  async show({ params: { id }, response }: HttpContext) {
    try {
      const plan = await PlanService.getPlan(id)
      return response.ok({ data: plan })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/license
   * Get the org's current license, associated plan details, and usage stats.
   *
   * - Org owners get the full response including usage breakdown.
   * - Regular members get plan name + features only.
   */
  async orgLicense({ params: { id }, response, user }: HttpContext) {
    if (!user) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    try {
      const licenseInfo = await PlanService.getOrgLicenseInfo(id)

      if (licenseInfo.status === 'none') {
        return response.ok({
          data: {
            plan: null,
            license: null,
            status: 'none',
            message: 'No active license found for this organisation.',
          },
        })
      }

      // Check if user is an owner of this org
      const isOwner = await this.isOrgOwner(id, user.$id)

      if (isOwner) {
        // Owners get full usage stats
        const usage = await PlanService.getOrgUsage(id)

        return response.ok({
          data: {
            plan: {
              id: licenseInfo.plan.$id,
              name: licenseInfo.plan.name,
              slug: licenseInfo.plan.slug,
              maxMembers: licenseInfo.plan.maxMembers,
              maxStorageMB: licenseInfo.plan.maxStorageMB,
              maxCouriersPerMonth: licenseInfo.plan.maxCouriersPerMonth,
              maxModules: licenseInfo.plan.maxModules,
              allowedModules: licenseInfo.plan.allowedModules,
              features: licenseInfo.plan.features,
            },
            license: {
              id: licenseInfo.license.$id,
              activatedAt: licenseInfo.license.activatedAt,
              expiresAt: licenseInfo.license.expiresAt,
              status: licenseInfo.status,
              daysRemaining: licenseInfo.daysRemaining,
              daysInGrace: licenseInfo.daysInGrace,
              issuedBy: licenseInfo.license.issuedBy,
            },
            usage,
          },
        })
      }

      // Regular members get a slimmer response
      return response.ok({
        data: {
          plan: {
            name: licenseInfo.plan.name,
            slug: licenseInfo.plan.slug,
            features: licenseInfo.plan.features,
          },
          license: {
            status: licenseInfo.status,
            expiresAt: licenseInfo.license.expiresAt,
            daysRemaining: licenseInfo.daysRemaining,
          },
        },
      })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * Check if a user is an owner of the given org (team).
   */
  private async isOrgOwner(orgId: string, userId: string): Promise<boolean> {
    try {
      const appwriteModule = await import('#services/appwrite_service')
      const appwrite = appwriteModule.default

      const memberships = await appwrite.teams.listMemberships({
        teamId: orgId,
      })

      const membership = memberships.memberships.find((m: any) => m.userId === userId)
      return membership?.roles?.includes('owner') ?? false
    } catch {
      return false
    }
  }
}
