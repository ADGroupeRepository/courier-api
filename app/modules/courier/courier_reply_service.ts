import appwrite from '#services/appwrite_service'
import appwriteConfig from '#config/appwrite'
import { ID, Query } from 'node-appwrite'
import { Collections } from '#modules/_registry/collection_ids'
import CourierService from '#modules/courier/courier_service'
import { CourierCustodyState } from '#modules/courier/courier_enums'

export interface CreateCourierReplyPayload {
  courierId: string
  subject: string
  emittedAt?: string
  fileIds?: string[]
  delivererName?: string
  delivererEmail?: string
  delivererPhone?: string
  ccUserIds?: string[]
  note?: string
  createdBy: string
}

/**
 * Service for managing courier replies within an organisation's isolated database.
 */
export default class CourierReplyService {
  private readonly databaseId: string
  private readonly bucketId: string
  private readonly collectionId = Collections.COURIER_REPLIES

  /**
   * Initializes the CourierReplyService with organization-specific resources.
   */
  constructor(databaseId: string, bucketId: string) {
    this.databaseId = databaseId
    this.bucketId = bucketId
  }

  /**
   * Factory method to initialize service for a specific organisation.
   */
  static async forOrg(orgId: string): Promise<CourierReplyService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId || !prefs.bucketId) {
      throw new Error(`Organisation ${orgId} does not have provisioned resources.`)
    }
    return new CourierReplyService(prefs.databaseId, prefs.bucketId)
  }

  /**
   * List replies for a specific courier.
   */
  async list(courierId: string, options?: { limit?: number; page?: number }) {
    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100)
    const page = Math.max(options?.page ?? 1, 1)
    const offset = (page - 1) * limit

    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [
        Query.equal('courierId', courierId),
        Query.orderAsc('createdAt'),
        Query.limit(limit),
        Query.offset(offset),
      ],
    })

    const userCache = new Map<string, any>()
    const documents = await Promise.all(
      result.documents.map((doc) => this.mapDocument(doc, userCache))
    )

    return {
      total: result.total,
      documents,
    }
  }

  /**
   * Create a new reply.
   */
  async create(payload: CreateCourierReplyPayload) {
    if (payload.fileIds && payload.fileIds.length > 0) {
      for (const fileId of payload.fileIds) {
        try {
          await appwrite.storage.getFile({ bucketId: this.bucketId, fileId })
        } catch (err: any) {
          throw new Error(`Attached file with ID '${fileId}' was not found in storage.`)
        }
      }
    }

    const doc = await appwrite.databases.createDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: ID.unique(),
      data: {
        courierId: payload.courierId,
        subject: payload.subject,
        content: payload.note || payload.subject || 'Courier Reply',
        emittedAt: payload.emittedAt || null,
        fileIds: payload.fileIds || [],
        delivererName: payload.delivererName || null,
        delivererEmail: payload.delivererEmail || null,
        delivererPhone: payload.delivererPhone || null,
        note: payload.note || null,
        createdBy: payload.createdBy,
        createdAt: new Date().toISOString(),
      },
    })

    // Increment the reply count on the courier and update custody
    try {
      const courierService = new CourierService(this.databaseId, this.bucketId)
      const courier = await courierService.get(payload.courierId)
      await appwrite.databases.updateDocument({
        databaseId: this.databaseId,
        collectionId: Collections.COURIERS,
        documentId: payload.courierId,
        data: {
          replyCount: (courier.replyCount || 0) + 1,
          requiresPickup: true,
          currentCustody: CourierCustodyState.SENDER,
          custodyUserId: payload.createdBy,
          custodyDeptId: null,
        },
      })
    } catch (err) {
      // Ignore failure to increment reply count, but log it
      console.error('Failed to increment reply count for courier', payload.courierId, err)
    }

    // Add CC users as assignments on the parent courier
    if (payload.ccUserIds && payload.ccUserIds.length > 0) {
      try {
        const courierService = new CourierService(this.databaseId, this.bucketId)
        await courierService.createAssignments(
          payload.courierId,
          payload.ccUserIds,
          'user',
          payload.createdBy
        )
      } catch (ccError) {
        console.error('Failed to create CC assignments for courier', payload.courierId, ccError)
      }
    }

    return await this.mapDocument(doc)
  }

  /**
   * Helper to resolve a user ID to their profile name and avatar URL.
   */
  private async resolveUserCreator(userId: string, userCache?: Map<string, any>) {
    if (!userId) return null
    if (userCache?.has(userId)) {
      return userCache.get(userId)
    }

    try {
      const user = await appwrite.users.get({ userId })
      const avatarFileId = user.prefs?.avatarFileId
      const avatarUrl = avatarFileId
        ? `${appwriteConfig.endpoint}/storage/buckets/public-media/files/${avatarFileId}/preview?project=${appwriteConfig.projectId}`
        : null

      const result = {
        id: userId,
        name: user.name || user.email || 'Unknown User',
        avatarUrl,
      }
      userCache?.set(userId, result)
      return result
    } catch {
      const result = {
        id: userId,
        name: 'Unknown User',
        avatarUrl: null,
      }
      userCache?.set(userId, result)
      return result
    }
  }

  /**
   * Helper to map an Appwrite document to our domain model.
   */
  private async mapDocument(doc: any, userCache?: Map<string, any>) {
    const fileUrls =
      doc.fileIds && doc.fileIds.length > 0
        ? doc.fileIds.map(
            (fileId: string) =>
              `${appwriteConfig.endpoint}/storage/buckets/${this.bucketId}/files/${fileId}/view?project=${appwriteConfig.projectId}`
          )
        : []

    const createdBy = await this.resolveUserCreator(doc.createdBy, userCache)

    return {
      id: doc.$id,
      courierId: doc.courierId,
      subject: doc.subject || null,
      emittedAt: doc.emittedAt || null,
      fileIds: doc.fileIds || [],
      fileUrls,
      delivererName: doc.delivererName || null,
      delivererEmail: doc.delivererEmail || null,
      delivererPhone: doc.delivererPhone || null,
      note: doc.note || null,
      createdBy,
      createdAt: doc.createdAt,
    }
  }
}
