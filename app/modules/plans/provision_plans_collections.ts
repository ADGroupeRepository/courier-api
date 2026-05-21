import appwrite from '#services/appwrite_service'
import { Permission, Role, IndexType } from 'node-appwrite'
import { Collections } from '#modules/_registry/collection_ids'

/**
 * Provisions the `plans` and `licenses` collections in the global
 * `bara-platform` database. These are platform-wide collections
 * (not per-org) and are created once.
 *
 * Run from an AdonisJS command or manually via the console.
 */
export class PlanProvisioner {
  private static readonly DATABASE_ID = 'bara-platform'

  /**
   * Create both collections with all attributes and indexes.
   * Safe to call multiple times — will skip if collections already exist.
   */
  static async provision() {
    console.log('[PlanProvisioner] Starting provisioning...')

    await this.createPlansCollection()
    await this.createSubscriptionsCollection()
    await this.createLicensesCollection()
    await this.ensureSubscriptionStatusAttribute()

    console.log('[PlanProvisioner] Provisioning complete.')
  }

  /**
   * Create the `plans` collection with all attributes and indexes.
   */
  private static async createPlansCollection() {
    const collectionId = Collections.PLANS

    try {
      // Check if collection already exists
      await appwrite.databases.getCollection({
        databaseId: this.DATABASE_ID,
        collectionId,
      })
      console.log(`[PlanProvisioner] Collection "${collectionId}" already exists. Skipping.`)
      return
    } catch {
      // Collection doesn't exist, create it
    }

    console.log(`[PlanProvisioner] Creating collection "${collectionId}"...`)

    await appwrite.databases.createCollection({
      databaseId: this.DATABASE_ID,
      collectionId,
      name: 'Plans',
      permissions: [Permission.read(Role.any())],
      documentSecurity: false,
    })

    // ── String attributes ───────────────────────────────────────────────
    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'name',
      size: 100,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'slug',
      size: 50,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'description',
      size: 500,
      required: false,
    })

    // ── Integer attributes ──────────────────────────────────────────────
    await appwrite.databases.createIntegerAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'price',
      required: true,
      min: 0,
    })

    await appwrite.databases.createIntegerAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'maxMembers',
      required: true,
      min: -1,
    })

    await appwrite.databases.createIntegerAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'maxStorageMB',
      required: true,
      min: -1,
    })

    await appwrite.databases.createIntegerAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'maxCouriersPerMonth',
      required: true,
      min: -1,
    })

    await appwrite.databases.createIntegerAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'maxModules',
      required: true,
      min: -1,
    })

    await appwrite.databases.createIntegerAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'sortOrder',
      required: false,
      xdefault: 0,
    })

    // ── Array attributes ────────────────────────────────────────────────
    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'allowedModules',
      size: 36,
      required: true,
      array: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'features',
      size: 100,
      required: true,
      array: true,
    })

    // ── Boolean attributes ──────────────────────────────────────────────
    await appwrite.databases.createBooleanAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'isActive',
      required: true,
      xdefault: true,
    })

    // Wait for attributes to be ready before creating indexes
    console.log('[PlanProvisioner] Waiting for plan attributes to be ready...')
    await this.waitForAttributes(collectionId)

    // ── Indexes ─────────────────────────────────────────────────────────
    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'slug_idx',
      type: IndexType.Unique,
      attributes: ['slug'],
    })

    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'active_idx',
      type: IndexType.Key,
      attributes: ['isActive'],
    })

    console.log(`[PlanProvisioner] Collection "${collectionId}" created successfully.`)
  }

  /**
   * Create the `subscriptions` collection with all attributes and indexes.
   */
  private static async createSubscriptionsCollection() {
    const collectionId = Collections.SUBSCRIPTIONS

    try {
      await appwrite.databases.getCollection({
        databaseId: this.DATABASE_ID,
        collectionId,
      })
      console.log(`[PlanProvisioner] Collection "${collectionId}" already exists. Skipping.`)
      return
    } catch {
      // Collection doesn't exist, create it
    }

    console.log(`[PlanProvisioner] Creating collection "${collectionId}"...`)

    await appwrite.databases.createCollection({
      databaseId: this.DATABASE_ID,
      collectionId,
      name: 'Subscriptions',
      permissions: [],
      documentSecurity: false,
    })

    // ── String attributes ───────────────────────────────────────────────
    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'planId',
      size: 36,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'orgId',
      size: 36,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'issuedBy',
      size: 36,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'notes',
      size: 500,
      required: false,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'status',
      size: 20,
      required: false,
      xdefault: 'active',
    })

    // ── DateTime attributes ─────────────────────────────────────────────
    await appwrite.databases.createDatetimeAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'activatedAt',
      required: true,
    })

    await appwrite.databases.createDatetimeAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'expiresAt',
      required: false,
    })

    // ── Boolean attributes ──────────────────────────────────────────────
    await appwrite.databases.createBooleanAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'isActive',
      required: true,
      xdefault: true,
    })

    // ── Integer attributes ──────────────────────────────────────────────
    await appwrite.databases.createIntegerAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'totalSeatsPurchased',
      required: true,
      min: 1,
    })

    // Wait for attributes to be ready before creating indexes
    console.log('[PlanProvisioner] Waiting for subscription attributes to be ready...')
    await this.waitForAttributes(collectionId)

    // ── Indexes ─────────────────────────────────────────────────────────
    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'orgId_idx',
      type: IndexType.Key,
      attributes: ['orgId'],
    })

    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'planId_idx',
      type: IndexType.Key,
      attributes: ['planId'],
    })

    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'active_plan_idx',
      type: IndexType.Key,
      attributes: ['orgId', 'isActive'],
    })

    console.log(`[PlanProvisioner] Collection "${collectionId}" created successfully.`)
  }

  /**
   * Create the `licenses` collection (per-user seats) with all attributes and indexes.
   */
  private static async createLicensesCollection() {
    const collectionId = Collections.LICENSES

    try {
      await appwrite.databases.getCollection({
        databaseId: this.DATABASE_ID,
        collectionId,
      })
      console.log(`[PlanProvisioner] Collection "${collectionId}" already exists. Skipping.`)
      return
    } catch {
      // Collection doesn't exist, create it
    }

    console.log(`[PlanProvisioner] Creating collection "${collectionId}"...`)

    await appwrite.databases.createCollection({
      databaseId: this.DATABASE_ID,
      collectionId,
      name: 'Licenses',
      permissions: [],
      documentSecurity: false,
    })

    // ── String attributes ───────────────────────────────────────────────
    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'subscriptionId',
      size: 36,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'orgId',
      size: 36,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'userId',
      size: 36,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'assignedBy',
      size: 36,
      required: true,
    })

    // ── DateTime attributes ─────────────────────────────────────────────
    await appwrite.databases.createDatetimeAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'assignedAt',
      required: true,
    })

    // ── Boolean attributes ──────────────────────────────────────────────
    await appwrite.databases.createBooleanAttribute({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'isActive',
      required: true,
      xdefault: true,
    })

    // Wait for attributes to be ready before creating indexes
    console.log('[PlanProvisioner] Waiting for license (seat) attributes to be ready...')
    await this.waitForAttributes(collectionId)

    // ── Indexes ─────────────────────────────────────────────────────────
    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'orgId_idx',
      type: IndexType.Key,
      attributes: ['orgId'],
    })

    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'userId_idx',
      type: IndexType.Key,
      attributes: ['userId'],
    })

    await appwrite.databases.createIndex({
      databaseId: this.DATABASE_ID,
      collectionId,
      key: 'active_seat_idx',
      type: IndexType.Key,
      attributes: ['userId', 'orgId', 'isActive'],
    })

    console.log(`[PlanProvisioner] Collection "${collectionId}" created successfully.`)
  }

  /**
   * Ensure that the 'status' attribute exists on the subscriptions collection.
   * Safe to call on existing or newly created databases.
   */
  private static async ensureSubscriptionStatusAttribute() {
    const collectionId = Collections.SUBSCRIPTIONS
    try {
      await appwrite.databases.getAttribute({
        databaseId: this.DATABASE_ID,
        collectionId,
        key: 'status',
      })
      console.log('[PlanProvisioner] Attribute "status" already exists on subscriptions.')
    } catch {
      console.log('[PlanProvisioner] Creating "status" attribute on subscriptions...')
      await appwrite.databases.createStringAttribute({
        databaseId: this.DATABASE_ID,
        collectionId,
        key: 'status',
        size: 20,
        required: false, // optional for backward compatibility
        xdefault: 'active', // default value for existing subscriptions is 'active'
      })
      await this.waitForAttributes(collectionId)
      console.log('[PlanProvisioner] Attribute "status" created successfully.')
    }
  }

  /**
   * Wait for all attributes in a collection to reach 'available' status.
   */
  private static async waitForAttributes(collectionId: string, maxRetries = 15) {
    for (let i = 0; i < maxRetries; i++) {
      const attrs = await appwrite.databases.listAttributes({
        databaseId: this.DATABASE_ID,
        collectionId,
      })

      const allReady = attrs.attributes.every((a: any) => a.status === 'available')
      if (allReady) return

      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    throw new Error(`Attributes for "${collectionId}" did not become available in time.`)
  }
}
