import type { HttpContext } from '@adonisjs/core/http'
import PlanService from '#modules/plans/plan_service'
import { subscribeToPlanValidator } from '#modules/plans/plan_validator'
import appwrite from '#services/appwrite_service'
import CacheService from '#services/cache_service'
import { Collections } from '#modules/_registry/collection_ids'
import { ID } from 'node-appwrite'

/**
 * PlansController — Public plan listing and org-scoped license/usage endpoints.
 *
 * Public routes:
 *   GET /api/v1/plans         → List all active plans
 *   GET /api/v1/plans/:planId → Get a single plan
 *
 * Org-scoped routes:
 *   GET /api/v1/organisations/:orgId/subscription → Get org subscription + plan + usage
 */
export default class PlansController {
  /**
   * Helper to clean up plan document fields.
   */
  private cleanPlan(plan: any) {
    if (!plan) return plan
    const {
      $databaseId,
      $collectionId,
      $permissions,
      $createdAt,
      $updatedAt,
      $sequence,
      sortOrder,
      ...clean
    } = plan
    return clean
  }

  /**
   * GET /api/v1/plans
   * List all active plans. Available to any authenticated user.
   */
  async index({ response }: HttpContext) {
    try {
      const plans = await PlanService.listActivePlans()
      const cleanPlans = plans.map((p) => this.cleanPlan(p))
      return response.ok({ data: cleanPlans })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/plans/:planId
   * Get details for a specific plan.
   */
  async show({ params: { planId }, response }: HttpContext) {
    try {
      const plan = await PlanService.getPlan(planId)
      return response.ok(this.cleanPlan(plan))
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/subscription
   * Get the org's current subscription, associated plan details, and usage stats.
   *
   * - Org owners get the full response including usage breakdown.
   * - Regular members get plan name + features only.
   */
  async orgSubscription({ params: { orgId }, response, user }: HttpContext) {
    if (!user) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    try {
      const subInfo = await PlanService.getOrgSubscriptionInfo(orgId)

      if (subInfo.status === 'none') {
        return response.ok({
          data: {
            plan: null,
            subscription: null,
            status: 'none',
            message: 'No active subscription found for this organisation.',
          },
        })
      }

      // Check if user is an owner of this org
      const isOwner = await this.isOrgOwner(orgId, user.$id)

      if (isOwner) {
        // Owners get full usage stats
        const usage = await PlanService.getOrgUsage(orgId)

        return response.ok({
          data: {
            plan: {
              id: subInfo.plan.$id,
              name: subInfo.plan.name,
              slug: subInfo.plan.slug,
              maxMembers: subInfo.plan.maxMembers,
              maxStorageMB: subInfo.plan.maxStorageMB,
              maxCouriersPerMonth: subInfo.plan.maxCouriersPerMonth,
              maxModules: subInfo.plan.maxModules,
              allowedModules: subInfo.plan.allowedModules,
              features: subInfo.plan.features,
            },
            subscription: {
              id: subInfo.subscription.$id,
              activatedAt: subInfo.subscription.activatedAt,
              expiresAt: subInfo.subscription.expiresAt,
              status: subInfo.status,
              daysRemaining: subInfo.daysRemaining,
              daysInGrace: subInfo.daysInGrace,
              issuedBy: subInfo.subscription.issuedBy,
            },
            usage,
          },
        })
      }

      // Regular members get a slimmer response
      return response.ok({
        data: {
          plan: {
            name: subInfo.plan.name,
            slug: subInfo.plan.slug,
            features: subInfo.plan.features,
          },
          subscription: {
            status: subInfo.status,
            expiresAt: subInfo.subscription.expiresAt,
            daysRemaining: subInfo.daysRemaining,
          },
        },
      })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/subscription
   * Allows an organisation owner to subscribe to a specific plan.
   */
  async subscribe({ request, response, user }: HttpContext) {
    if (!user) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    const orgId = request.param('orgId')
    const payload = await request.validateUsing(subscribeToPlanValidator)

    try {
      // 1. Verify user is owner
      const isOwner = await this.isOrgOwner(orgId, user.$id)
      if (!isOwner) {
        return response.unauthorized({
          message: 'Only organisation owners can manage subscriptions.',
        })
      }

      // 2. Verify plan exists and is active
      const plan = await PlanService.getPlan(payload.planId)
      if (!plan.isActive) {
        return response.badRequest({ message: 'The selected plan is not active.' })
      }

      // 3. Check for existing subscription conflicts
      const existingSub = await PlanService.getOrgSubscription(orgId)
      if (existingSub) {
        const existingStatus = existingSub.status || (existingSub.isActive ? 'active' : 'none')

        if (existingStatus === 'pending') {
          return response.conflict({
            message:
              'A subscription request is already pending approval. Please wait for the administrator to review it before submitting a new one.',
          })
        }

        if (existingSub.isActive) {
          return response.conflict({
            message:
              'This organisation already has an active subscription. Please contact an administrator to change your plan.',
          })
        }
      }

      // 4. Process payment
      // TODO: Integrate Stripe/payment gateway here to charge for `plan.price`

      const totalSeatsPurchased = plan.maxMembers === -1 ? 999999 : plan.maxMembers

      // 5. Create new subscription (starts as pending approval)
      const subscription = await appwrite.databases.createDocument({
        databaseId: 'bara-platform',
        collectionId: Collections.SUBSCRIPTIONS,
        documentId: ID.unique(),
        data: {
          planId: payload.planId,
          orgId: orgId,
          activatedAt: new Date().toISOString(),
          isActive: false, // Starts inactive until approved
          status: 'pending', // Set pending status
          totalSeatsPurchased: totalSeatsPurchased,
          issuedBy: user.$id,
        },
      })

      // Clear subscription info cache so the user's profile shows the pending state immediately
      await CacheService.delete(`subscription:info:${orgId}`)

      // 6. Seat license is not assigned yet (will be assigned automatically upon admin approval)

      return response.created({
        message:
          'Your subscription request has been submitted. An administrator will activate your account as soon as possible.',
      })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan or organisation not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * Check if a user is an owner of the given org (team).
   */
  private async isOrgOwner(orgId: string, userId: string): Promise<boolean> {
    try {
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
