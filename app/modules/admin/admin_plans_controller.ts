import type { HttpContext } from '@adonisjs/core/http'
import appwrite from '#services/appwrite_service'
import PlanService from '#modules/plans/plan_service'
import CacheService from '#services/cache_service'
import { Collections } from '#modules/_registry/collection_ids'
import { ID, Query } from 'node-appwrite'
import EmailService from '#services/email_service'
import ModuleProvisioningService from '#modules/_registry/provisioning_service'
import {
  createPlanValidator,
  updatePlanValidator,
  issueSubscriptionValidator,
  updateSubscriptionValidator,
} from '#modules/plans/plan_validator'

/**
 * Helper to remove Appwrite-internal metadata properties from API responses,
 * while leaving $id intact.
 */
function cleanAppwriteDoc(doc: any) {
  if (!doc) return doc
  const {
    $databaseId,
    $collectionId,
    $permissions,
    $createdAt,
    $updatedAt,
    $sequence,
    sortOrder,
    ...clean
  } = doc
  return clean
}

/**
 * Admin-scoped controller for managing global plans and licenses.
 * All routes are protected by auth + admin middleware.
 */
export default class AdminPlansController {
  private readonly databaseId = 'bara-platform'

  // ── Plan CRUD ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/plans
   * List all plans (including inactive).
   */
  async indexPlans({ response }: HttpContext) {
    try {
      const result = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: Collections.PLANS,
        queries: [Query.orderAsc('sortOrder')],
      })
      const cleanDocs = result.documents.map(cleanAppwriteDoc)
      return response.ok({ data: cleanDocs, total: result.total })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/admin/plans
   * Create a new plan.
   */
  async storePlan({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createPlanValidator)

    try {
      // Check slug uniqueness
      const existing = await PlanService.getPlanBySlug(payload.slug)
      if (existing) {
        return response.conflict({
          message: `A plan with slug "${payload.slug}" already exists.`,
        })
      }

      const plan = await appwrite.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: Collections.PLANS,
        documentId: ID.unique(),
        data: {
          name: payload.name,
          slug: payload.slug,
          description: payload.description || '',
          price: payload.price,

          maxMembers: payload.maxMembers,
          maxStorageMB: payload.maxStorageMB,
          maxCouriersPerMonth: payload.maxCouriersPerMonth,
          maxModules: payload.maxModules,
          allowedModules: payload.allowedModules,
          features: payload.features,
          isActive: payload.isActive ?? true,
          sortOrder: payload.sortOrder ?? 0,
        },
      })

      return response.created({
        data: cleanAppwriteDoc(plan),
        message: 'Plan created successfully.',
      })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PATCH /api/v1/admin/plans/:planId
   * Update a plan.
   */
  async updatePlan({ request, response }: HttpContext) {
    const planId = request.param('planId')
    const payload = await request.validateUsing(updatePlanValidator)

    try {
      // If updating slug, check uniqueness
      if (payload.slug) {
        const existing = await PlanService.getPlanBySlug(payload.slug)
        if (existing && existing.$id !== planId) {
          return response.conflict({
            message: `A plan with slug "${payload.slug}" already exists.`,
          })
        }
      }

      // Build the data object with only provided fields
      const data: Record<string, any> = {}
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined) {
          data[key] = value
        }
      }

      const plan = await appwrite.databases.updateDocument({
        databaseId: this.databaseId,
        collectionId: Collections.PLANS,
        documentId: planId,
        data,
      })

      return response.ok({ data: cleanAppwriteDoc(plan), message: 'Plan updated successfully.' })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/admin/plans/:planId
   * Deactivate a plan (soft delete — sets isActive = false).
   */
  async destroyPlan({ request, response }: HttpContext) {
    const planId = request.param('planId')

    try {
      await appwrite.databases.updateDocument({
        databaseId: this.databaseId,
        collectionId: Collections.PLANS,
        documentId: planId,
        data: { isActive: false },
      })

      return response.ok({ message: 'Plan deactivated successfully.' })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/admin/plans/:planId/usage
   * Get plan usage stats: how many subscriptions issued vs max allowed.
   */
  async planUsage({ request, response }: HttpContext) {
    const planId = request.param('planId')

    try {
      const plan = await PlanService.getPlan(planId)
      const issuedCount = await PlanService.countIssuedSubscriptions(planId)

      return response.ok({
        data: {
          planId: plan.$id,
          planName: plan.name,
          issuedSubscriptions: issuedCount,
        },
      })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  // ── Subscription Management ────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/subscriptions
   * Issue a new subscription to an organisation.
   */
  async issueSubscription({ request, response, user, logger }: HttpContext) {
    const payload = await request.validateUsing(issueSubscriptionValidator)

    if (!user) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    try {
      // 1. Verify the plan exists and is active
      const plan = await PlanService.getPlan(payload.planId)
      if (!plan.isActive) {
        return response.badRequest({
          message: 'Cannot issue a subscription for an inactive plan.',
        })
      }

      // 3. Deactivate any existing active subscription for this org
      const existingSub = await PlanService.getOrgSubscription(payload.orgId)
      if (existingSub) {
        await appwrite.databases.updateDocument({
          databaseId: this.databaseId,
          collectionId: Collections.SUBSCRIPTIONS,
          documentId: existingSub.$id,
          data: { isActive: false },
        })
      }

      // 4. Create new subscription
      const subscription = await appwrite.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: Collections.SUBSCRIPTIONS,
        documentId: ID.unique(),
        data: {
          planId: payload.planId,
          orgId: payload.orgId,
          activatedAt: new Date().toISOString(),
          expiresAt: payload.expiresAt || null,
          isActive: true,
          status: 'active',
          totalSeatsPurchased: payload.totalSeatsPurchased,
          issuedBy: user.$id,
          notes: payload.notes || '',
        },
      })

      // Clear subscription info cache
      await CacheService.delete(`subscription:info:${payload.orgId}`)

      // Auto-activate courier module if allowed in plan
      if (plan.allowedModules && plan.allowedModules.includes('courier')) {
        try {
          const moduleService = new ModuleProvisioningService()
          await moduleService.activate(payload.orgId, 'courier')
        } catch (moduleError) {
          logger.error({ err: moduleError, orgId: payload.orgId }, 'Failed to auto-activate courier module during subscription issue')
        }
      }

      return response.created({
        data: cleanAppwriteDoc(subscription),
        message: 'Subscription issued successfully.',
      })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan or organisation not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/admin/subscriptions
   * List all subscriptions. Supports filtering by orgId, planId, isActive.
   */
  async indexSubscriptions({ request, response }: HttpContext) {
    const orgId = request.qs().orgId as string | undefined
    const planId = request.qs().planId as string | undefined
    const isActive = request.qs().isActive as string | undefined

    try {
      const result = await PlanService.listSubscriptions({
        orgId,
        planId,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      })

      const cleanDocs = result.documents.map(cleanAppwriteDoc)
      return response.ok({ data: cleanDocs, total: result.total })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PATCH /api/v1/admin/subscriptions/:subscriptionId
   * Update or revoke a subscription.
   */
  async updateSubscription({ request, response, logger }: HttpContext) {
    const subscriptionId = request.param('subscriptionId')
    const payload = await request.validateUsing(updateSubscriptionValidator)

    try {
      // Fetch existing subscription details
      const existing = await appwrite.databases.getDocument(
        this.databaseId,
        Collections.SUBSCRIPTIONS,
        subscriptionId
      )

      const data: Record<string, any> = {}
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined) {
          data[key] = value
        }
      }

      // If transitioning to active
      if (payload.status === 'active') {
        data.isActive = true
        data.activatedAt = new Date().toISOString()
      } else if (payload.status === 'rejected') {
        data.isActive = false
      }

      const subscription = await appwrite.databases.updateDocument({
        databaseId: this.databaseId,
        collectionId: Collections.SUBSCRIPTIONS,
        documentId: subscriptionId,
        data,
      })

      // Clear cache
      await CacheService.delete(`subscription:info:${existing.orgId}`)

      // If status changed to active, assign license and send email notification
      if (payload.status === 'active' && existing.status !== 'active') {
        // Auto-activate courier module if allowed in plan
        try {
          const planDoc = await PlanService.getPlan(existing.planId)
          if (planDoc.allowedModules && planDoc.allowedModules.includes('courier')) {
            const moduleService = new ModuleProvisioningService()
            await moduleService.activate(existing.orgId, 'courier')
          }
        } catch (moduleError) {
          logger.error({ err: moduleError, orgId: existing.orgId }, 'Failed to auto-activate courier module during subscription update')
        }

        if (existing.issuedBy) {
          try {
            await PlanService.assignLicenseToUser(
              existing.orgId,
              existing.issuedBy,
              existing.issuedBy
            )
          } catch (licenseError: any) {
            if (licenseError.message === 'User already has an active license.') {
              logger.info(
                { orgId: existing.orgId, userId: existing.issuedBy },
                'User already has an active license, skipping auto-assign.'
              )
            } else {
              logger.error(
                { err: licenseError, orgId: existing.orgId, userId: existing.issuedBy },
                'Failed to automatically assign license to user'
              )
            }
          }

          // Send approval notification email to the user who requested/issued it
          try {
            const userDoc = await appwrite.users.get({ userId: existing.issuedBy })
            const planDoc = await PlanService.getPlan(existing.planId)
            const orgDoc = await appwrite.teams.get({ teamId: existing.orgId })

            await EmailService.send({
              to: userDoc.email,
              subject: 'Votre abonnement a été approuvé !',
              text: `Bonjour ${userDoc.name},\n\nNous avons le plaisir de vous informer que votre demande d'abonnement au forfait "${planDoc.name}" pour l'organisation "${orgDoc.name}" a été approuvée.\n\nVous pouvez dès à présent vous connecter et profiter de l'ensemble de vos fonctionnalités.\n\nL'équipe Bara.`,
              html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
                  <h2 style="color: #4f46e5; margin-bottom: 20px;">Félicitations !</h2>
                  <p>Bonjour <strong>${userDoc.name}</strong>,</p>
                  <p>Nous avons le plaisir de vous informer que votre demande d'abonnement au forfait <strong>${planDoc.name}</strong> pour l'organisation <strong>${orgDoc.name}</strong> a été approuvée.</p>
                  <p>Toutes les fonctionnalités de votre formule sont désormais entièrement actives pour votre équipe.</p>
                  <div style="margin: 30px 0; text-align: center;">
                    <a href="https://bara.run" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accéder à mon espace</a>
                  </div>
                  <p style="font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 30px;">
                    L'équipe Bara.<br/>
                    <em>Ceci est un message automatique, merci de ne pas y répondre directement.</em>
                  </p>
                </div>
              `,
            })
          } catch (emailErr) {
            logger.error(
              { err: emailErr, userId: existing.issuedBy },
              'Failed to send subscription approval notification email'
            )
          }
        }
      }

      return response.ok({
        data: cleanAppwriteDoc(subscription),
        message: 'Subscription updated successfully.',
      })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Subscription not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }
}
