import type { HttpContext } from '@adonisjs/core/http'
import appwrite from '#services/appwrite_service'
import PlanService from '#modules/plans/plan_service'
import { Collections } from '#modules/_registry/collection_ids'
import { ID, Query } from 'node-appwrite'
import {
  createPlanValidator,
  updatePlanValidator,
  issueLicenseValidator,
  updateLicenseValidator,
} from '#modules/plans/plan_validator'

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
      return response.ok({ data: result.documents, total: result.total })
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
          maxLicenses: payload.maxLicenses,
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

      return response.created({ data: plan, message: 'Plan created successfully.' })
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

      return response.ok({ data: plan, message: 'Plan updated successfully.' })
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
   * Get plan usage stats: how many licenses issued vs max allowed.
   */
  async planUsage({ request, response }: HttpContext) {
    const planId = request.param('planId')

    try {
      const plan = await PlanService.getPlan(planId)
      const issuedCount = await PlanService.countIssuedLicenses(planId)

      return response.ok({
        data: {
          planId: plan.$id,
          planName: plan.name,
          maxLicenses: plan.maxLicenses,
          issuedLicenses: issuedCount,
          remainingLicenses: plan.maxLicenses === -1 ? -1 : plan.maxLicenses - issuedCount,
        },
      })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  // ── License Management ────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/licenses
   * Issue a new license to an organisation.
   */
  async issueLicense({ request, response, user }: HttpContext) {
    const payload = await request.validateUsing(issueLicenseValidator)

    if (!user) {
      return response.unauthorized({ message: 'Authentication required' })
    }

    try {
      // 1. Verify the plan exists and is active
      const plan = await PlanService.getPlan(payload.planId)
      if (!plan.isActive) {
        return response.badRequest({
          message: 'Cannot issue a license for an inactive plan.',
        })
      }

      // 2. Check if max licenses for this plan have been reached
      if (plan.maxLicenses !== -1) {
        const issuedCount = await PlanService.countIssuedLicenses(payload.planId)
        if (issuedCount >= plan.maxLicenses) {
          return response.conflict({
            message: `Maximum license count (${plan.maxLicenses}) reached for plan "${plan.name}".`,
          })
        }
      }

      // 3. Deactivate any existing active license for this org
      const existingLicense = await PlanService.getOrgLicense(payload.orgId)
      if (existingLicense) {
        await appwrite.databases.updateDocument({
          databaseId: this.databaseId,
          collectionId: Collections.LICENSES,
          documentId: existingLicense.$id,
          data: { isActive: false },
        })
      }

      // 4. Create new license
      const license = await appwrite.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: Collections.LICENSES,
        documentId: ID.unique(),
        data: {
          planId: payload.planId,
          orgId: payload.orgId,
          activatedAt: new Date().toISOString(),
          expiresAt: payload.expiresAt || null,
          isActive: true,
          issuedBy: user.$id,
          notes: payload.notes || '',
        },
      })

      return response.created({ data: license, message: 'License issued successfully.' })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Plan or organisation not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/admin/licenses
   * List all licenses. Supports filtering by orgId, planId, isActive.
   */
  async indexLicenses({ request, response }: HttpContext) {
    const orgId = request.qs().orgId as string | undefined
    const planId = request.qs().planId as string | undefined
    const isActive = request.qs().isActive as string | undefined

    try {
      const result = await PlanService.listLicenses({
        orgId,
        planId,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      })

      return response.ok({ data: result.documents, total: result.total })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PATCH /api/v1/admin/licenses/:licenseId
   * Update or revoke a license.
   */
  async updateLicense({ request, response }: HttpContext) {
    const licenseId = request.param('licenseId')
    const payload = await request.validateUsing(updateLicenseValidator)

    try {
      const data: Record<string, any> = {}
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined) {
          data[key] = value
        }
      }

      const license = await appwrite.databases.updateDocument({
        databaseId: this.databaseId,
        collectionId: Collections.LICENSES,
        documentId: licenseId,
        data,
      })

      return response.ok({ data: license, message: 'License updated successfully.' })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'License not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }
}
