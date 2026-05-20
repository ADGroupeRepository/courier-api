import appwrite from '#services/appwrite_service'
import appwriteConfig from '#config/appwrite'
import { ID, Query } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import { Collections } from '#modules/_registry/collection_ids'

export interface CreateCourierMessagePayload {
  courierId: string
  content: string
  createdBy: string
}

/**
 * Service for managing courier chat messages within an organisation's isolated database.
 */
export default class CourierChatService {
  private readonly databaseId: string
  private readonly bucketId: string
  private readonly collectionId = Collections.COURIER_MESSAGES

  /**
   * Initializes the CourierChatService with organization-specific resources.
   */
  constructor(databaseId: string, bucketId: string) {
    this.databaseId = databaseId
    this.bucketId = bucketId
  }

  /**
   * Factory method to initialize service for a specific organisation.
   */
  static async forOrg(orgId: string): Promise<CourierChatService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId || !prefs.bucketId) {
      throw new Error(`Organisation ${orgId} does not have provisioned resources.`)
    }
    return new CourierChatService(prefs.databaseId, prefs.bucketId)
  }

  /**
   * List messages for a specific courier.
   */
  async list(courierId: string, options?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)
    const offset = Math.max(options?.offset ?? 0, 0)

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
   * Create a new chat message with an optional file attachment.
   */
  async create(
    payload: CreateCourierMessagePayload,
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
    }
  }
}
