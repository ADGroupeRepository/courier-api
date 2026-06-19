import appwrite from '#services/appwrite_service'
import appwriteConfig from '#config/appwrite'
import { ID, Query } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import { Collections } from '#modules/_registry/collection_ids'
import CourierService from '#modules/courier/courier_service'
import { type DocumentStatus } from '#modules/courier/courier_enums'

export interface CreateCourierReplyPayload {
  courierId: string
  content: string
  createdBy: string
}

export interface UpdateCourierReplyPayload {
  documentStatus?: DocumentStatus
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

    return {
      total: result.total,
      documents: result.documents.map((doc) => this.mapDocument(doc)),
    }
  }

  /**
   * Create a new reply with an optional file attachment.
   */
  async create(
    payload: CreateCourierReplyPayload,
    fileOptions?: { tmpPath: string; fileName: string }
  ) {
    let fileId: string | undefined

    if (fileOptions) {
      const file = InputFile.fromPath(fileOptions.tmpPath, fileOptions.fileName)
      const uploadedFile = await appwrite.storage.createFile({
        bucketId: this.bucketId,
        fileId: ID.unique(),
        file,
      })
      fileId = uploadedFile.$id
    }

    try {
      const doc = await appwrite.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        documentId: ID.unique(),
        data: {
          ...payload,
          fileId: fileId || null,
          createdAt: new Date().toISOString(),
        },
      })

      // Increment the reply count on the courier
      try {
        const courierService = new CourierService(this.databaseId, this.bucketId)
        const courier = await courierService.get(payload.courierId)
        await appwrite.databases.updateDocument({
          databaseId: this.databaseId,
          collectionId: Collections.COURIERS,
          documentId: payload.courierId,
          data: {
            replyCount: (courier.replyCount || 0) + 1,
          },
        })
      } catch (err) {
        // Ignore failure to increment reply count, but log it
        console.error('Failed to increment reply count for courier', payload.courierId, err)
      }

      return this.mapDocument(doc)
    } catch (error) {
      if (fileId) {
        await appwrite.storage.deleteFile({
          bucketId: this.bucketId,
          fileId,
        })
      }
      throw error
    }
  }

  /**
   * Update a courier reply by ID.
   */
  async update(replyId: string, payload: UpdateCourierReplyPayload) {
    const doc = await appwrite.databases.updateDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: replyId,
      data: payload,
    })

    return this.mapDocument(doc)
  }

  /**
   * Helper to map an Appwrite document to our domain model.
   */
  private mapDocument(doc: any) {
    const fileUrl = doc.fileId
      ? `${appwriteConfig.endpoint}/storage/buckets/${this.bucketId}/files/${doc.fileId}/view?project=${appwriteConfig.projectId}`
      : null

    return {
      id: doc.$id,
      courierId: doc.courierId,
      content: doc.content,
      fileUrl,
      fileId: doc.fileId || null,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      documentStatus: doc.documentStatus,
    }
  }
}
