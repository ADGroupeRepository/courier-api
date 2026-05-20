import appwrite from '#services/appwrite_service'
import { Collections } from '#modules/_registry/collection_ids'
import { Query } from 'node-appwrite'
import CacheService from '#services/cache_service'

/**
 * The global `bara-platform` database ID where plans and licenses live.
 */
const PLATFORM_DB = 'bara-platform'

/**
 * Grace period in days after license expiry.
 * During this window, gated features remain accessible but the frontend
 * should show a warning banner urging the org to renew.
 */
const GRACE_PERIOD_DAYS = 5

export type SubscriptionStatus = 'active' | 'grace_period' | 'expired' | 'none'

export interface SubscriptionInfo {
  subscription: any
  plan: any
  status: SubscriptionStatus
  daysRemaining: number | null
  daysInGrace: number | null
}

export interface PlanUsage {
  members: { used: number; max: number }
  storageMB: { used: number; max: number }
  couriersThisMonth: { used: number; max: number }
  modulesActive: { used: number; max: number }
}

/**
 * PlanService — handles plan lookups, license enforcement, and usage calculation.
 *
 * All reads go to the global `bara-platform` database.
 * Org-scoped usage stats (members, storage, etc.) require cross-referencing
 * with the org's team and database.
 */
export default class PlanService {
  // ── Plan CRUD helpers ─────────────────────────────────────────────────

  /**
   * List all active plans (public).
   */
  static async listActivePlans() {
    const result = await appwrite.databases.listDocuments({
      databaseId: PLATFORM_DB,
      collectionId: Collections.PLANS,
      queries: [Query.equal('isActive', true), Query.orderAsc('sortOrder')],
    })
    return result.documents
  }

  /**
   * Get a single plan by ID.
   */
  static async getPlan(planId: string) {
    return appwrite.databases.getDocument({
      databaseId: PLATFORM_DB,
      collectionId: Collections.PLANS,
      documentId: planId,
    })
  }

  /**
   * Get a single plan by slug.
   */
  static async getPlanBySlug(slug: string) {
    const result = await appwrite.databases.listDocuments({
      databaseId: PLATFORM_DB,
      collectionId: Collections.PLANS,
      queries: [Query.equal('slug', slug), Query.limit(1)],
    })
    return result.documents[0] || null
  }

  // ── Subscription management ──────────────────────────────────────────

  /**
   * Get the active subscription for an organisation (returns the most recent active one).
   */
  static async getOrgSubscription(orgId: string): Promise<any | null> {
    const result = await appwrite.databases.listDocuments({
      databaseId: PLATFORM_DB,
      collectionId: Collections.SUBSCRIPTIONS,
      queries: [
        Query.equal('orgId', orgId),
        Query.equal('isActive', true),
        Query.orderDesc('$createdAt'),
        Query.limit(1),
      ],
    })
    return result.documents[0] || null
  }

  /**
   * Get the full subscription info for an organisation, including the associated plan
   * and computed subscription status (active, grace_period, expired, or none).
   */
  static async getOrgSubscriptionInfo(orgId: string): Promise<SubscriptionInfo> {
    const cacheKey = `subscription:info:${orgId}`
    const cached = await CacheService.get<SubscriptionInfo>(cacheKey)
    if (cached) {
      return cached
    }

    const subscription = await this.getOrgSubscription(orgId)

    if (!subscription) {
      const result: SubscriptionInfo = {
        subscription: null,
        plan: null,
        status: 'none',
        daysRemaining: null,
        daysInGrace: null,
      }
      await CacheService.set(cacheKey, result, 300) // cache negative result for 5 mins too
      return result
    }

    const plan = await this.getPlan(subscription.planId)
    const { status, daysRemaining, daysInGrace } = this.computeSubscriptionStatus(subscription)

    const result: SubscriptionInfo = { subscription, plan, status, daysRemaining, daysInGrace }
    await CacheService.set(cacheKey, result, 300) // cache positive result for 5 mins
    return result
  }

  /**
   * Compute the current status of a subscription based on its expiresAt date
   * and the 5-day grace period.
   */
  static computeSubscriptionStatus(subscription: any): {
    status: SubscriptionStatus
    daysRemaining: number | null
    daysInGrace: number | null
  } {
    if (!subscription.expiresAt) {
      // No expiration — always active
      return { status: 'active', daysRemaining: null, daysInGrace: null }
    }

    const now = new Date()
    const expiresAt = new Date(subscription.expiresAt)
    const diffMs = expiresAt.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      // Still active
      return { status: 'active', daysRemaining: diffDays, daysInGrace: null }
    }

    // Expired — check grace period
    const graceDays = Math.abs(diffDays)
    if (graceDays <= GRACE_PERIOD_DAYS) {
      return {
        status: 'grace_period',
        daysRemaining: 0,
        daysInGrace: GRACE_PERIOD_DAYS - graceDays,
      }
    }

    // Beyond grace period
    return { status: 'expired', daysRemaining: 0, daysInGrace: 0 }
  }

  // ── Seat License management ──────────────────────────────────────────

  /**
   * Get the active seat license for a specific user in an org.
   */
  static async getUserLicense(orgId: string, userId: string): Promise<any | null> {
    const result = await appwrite.databases.listDocuments({
      databaseId: PLATFORM_DB,
      collectionId: Collections.LICENSES,
      queries: [
        Query.equal('orgId', orgId),
        Query.equal('userId', userId),
        Query.equal('isActive', true),
        Query.limit(1),
      ],
    })
    return result.documents[0] || null
  }

  /**
   * Assign a seat license to a user.
   */
  static async assignLicenseToUser(orgId: string, adminUserId: string, targetUserId: string) {
    const subInfo = await this.getOrgSubscriptionInfo(orgId)
    if (subInfo.status === 'none' || subInfo.status === 'expired') {
      throw new Error('Organisation does not have an active subscription.')
    }

    const existing = await this.getUserLicense(orgId, targetUserId)
    if (existing) {
      throw new Error('User already has an active license.')
    }

    const totalPurchased = subInfo.subscription.totalSeatsPurchased
    const activeSeatsResult = await appwrite.databases.listDocuments({
      databaseId: PLATFORM_DB,
      collectionId: Collections.LICENSES,
      queries: [Query.equal('orgId', orgId), Query.equal('isActive', true)],
    })

    if (activeSeatsResult.total >= totalPurchased) {
      throw new Error(`Maximum seats reached. You have ${totalPurchased} seats.`)
    }

    const { ID } = await import('node-appwrite')

    return appwrite.databases.createDocument({
      databaseId: PLATFORM_DB,
      collectionId: Collections.LICENSES,
      documentId: ID.unique(),
      data: {
        subscriptionId: subInfo.subscription.$id,
        orgId,
        userId: targetUserId,
        assignedBy: adminUserId,
        assignedAt: new Date().toISOString(),
        isActive: true,
      },
    })
  }

  /**
   * Revoke a seat license from a user.
   */
  static async revokeLicenseFromUser(orgId: string, targetUserId: string) {
    const existing = await this.getUserLicense(orgId, targetUserId)
    if (!existing) {
      throw new Error('User does not have an active license.')
    }

    return appwrite.databases.updateDocument({
      databaseId: PLATFORM_DB,
      collectionId: Collections.LICENSES,
      documentId: existing.$id,
      data: { isActive: false },
    })
  }

  // ── Plan enforcement ──────────────────────────────────────────────────

  /**
   * Check if a specific user's seat license allows a specific feature.
   */
  static async checkUserFeature(orgId: string, userId: string, feature: string): Promise<boolean> {
    const userLicense = await this.getUserLicense(orgId, userId)
    if (!userLicense) return false

    const info = await this.getOrgSubscriptionInfo(orgId)
    if (info.status === 'expired' || info.status === 'none') return false
    if (!info.plan) return false

    const features: string[] = info.plan.features || []
    return features.includes(feature) || features.includes('*')
  }

  /**
   * Check if a specific user's seat license allows a specific module.
   */
  static async checkUserModule(
    orgId: string,
    userId: string,
    moduleName: string
  ): Promise<boolean> {
    const userLicense = await this.getUserLicense(orgId, userId)
    if (!userLicense) return false

    const info = await this.getOrgSubscriptionInfo(orgId)
    if (info.status === 'expired' || info.status === 'none') return false
    if (!info.plan) return false

    const allowed: string[] = info.plan.allowedModules || []
    return allowed.includes(moduleName) || allowed.includes('*')
  }

  /**
   * Check a numeric limit (e.g., maxMembers, maxCouriersPerMonth).
   * Returns true if currentCount is below the plan limit.
   * A limit of -1 means unlimited.
   */
  static async checkLimit(orgId: string, limitKey: string, currentCount: number): Promise<boolean> {
    const info = await this.getOrgSubscriptionInfo(orgId)
    if (info.status === 'expired' || info.status === 'none') return false
    if (!info.plan) return false

    const limit = info.plan[limitKey]
    if (limit === undefined) return true // Unknown limit key → allow
    if (limit === -1) return true // Unlimited
    return currentCount < limit
  }

  // ── Usage stats (for org owner dashboard) ─────────────────────────────

  /**
   * Calculate resource usage for an org against its plan limits.
   */
  static async getOrgUsage(orgId: string): Promise<PlanUsage> {
    const info = await this.getOrgSubscriptionInfo(orgId)
    if (!info.plan) {
      return {
        members: { used: 0, max: 0 },
        storageMB: { used: 0, max: 0 },
        couriersThisMonth: { used: 0, max: 0 },
        modulesActive: { used: 0, max: 0 },
      }
    }

    // Get member count from the team
    let memberCount = 0
    try {
      const members = await appwrite.teams.listMemberships({
        teamId: orgId,
        queries: [Query.limit(1)],
      })
      memberCount = members.total
    } catch {
      // Team might not exist yet
    }

    // Get active module count from team prefs
    let moduleCount = 0
    try {
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      moduleCount = (prefs.modules || []).length
    } catch {
      // Prefs might not exist yet
    }

    // Get courier count this month from org database
    let courierCount = 0
    try {
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      const dbId = prefs.databaseId
      if (dbId) {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const result = await appwrite.databases.listDocuments({
          databaseId: dbId,
          collectionId: Collections.COURIERS,
          queries: [
            Query.greaterThanEqual('$createdAt', startOfMonth.toISOString()),
            Query.limit(1),
          ],
        })
        courierCount = result.total
      }
    } catch {
      // Database or collection might not exist
    }

    // Storage usage would require Storage API — approximated as 0 for now
    // TODO: Implement storage usage calculation via appwrite.storage.listFiles()
    const storageMB = 0

    return {
      members: { used: memberCount, max: info.plan.maxMembers },
      storageMB: { used: storageMB, max: info.plan.maxStorageMB },
      couriersThisMonth: { used: courierCount, max: info.plan.maxCouriersPerMonth },
      modulesActive: { used: moduleCount, max: info.plan.maxModules },
    }
  }

  // ── Admin helpers ─────────────────────────────────────────────────────

  /**
   * Count how many active subscriptions have been issued for a specific plan.
   */
  static async countIssuedSubscriptions(planId: string): Promise<number> {
    const result = await appwrite.databases.listDocuments({
      databaseId: PLATFORM_DB,
      collectionId: Collections.SUBSCRIPTIONS,
      queries: [Query.equal('planId', planId), Query.equal('isActive', true), Query.limit(1)],
    })
    return result.total
  }

  /**
   * List all subscriptions (admin), with optional filters.
   */
  static async listSubscriptions(filters?: {
    orgId?: string
    planId?: string
    isActive?: boolean
  }) {
    const queries: string[] = []

    if (filters?.orgId) queries.push(Query.equal('orgId', filters.orgId))
    if (filters?.planId) queries.push(Query.equal('planId', filters.planId))
    if (filters?.isActive !== undefined) queries.push(Query.equal('isActive', filters.isActive))

    queries.push(Query.orderDesc('$createdAt'))

    const result = await appwrite.databases.listDocuments({
      databaseId: PLATFORM_DB,
      collectionId: Collections.SUBSCRIPTIONS,
      queries,
    })

    return result
  }
}
