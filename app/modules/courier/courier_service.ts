import appwrite from '#services/appwrite_service'
import appwriteConfig from '#config/appwrite'
import { ID, Query } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'

export interface CreateCourierPayload {
  type: 'incoming' | 'outgoing'
  subject: string
  sender?: string
  recipient?: string
  assignedTo: string
  targetType: 'user' | 'department'
  createdBy: string
}

export interface UpdateCourierPayload {
  subject?: string
  sender?: string
  recipient?: string
  assignedTo?: string
  status?: 'pending' | 'received' | 'assigned' | 'sent' | 'completed'
}

/**
 * Service for managing couriers within an organisation's isolated database and bucket.
 */
export default class CourierService {
  private readonly databaseId: string
  private readonly bucketId: string
  private readonly collectionId = 'couriers'

  constructor(databaseId: string, bucketId: string) {
    this.databaseId = databaseId
    this.bucketId = bucketId
  }

  /**
   * Factory method to initialize service for a specific organisation.
   */
  static async forOrg(orgId: string): Promise<CourierService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId || !prefs.bucketId) {
      throw new Error(`Organisation ${orgId} does not have provisioned resources.`)
    }
    return new CourierService(prefs.databaseId, prefs.bucketId)
  }

  /**
   * List couriers for the organisation.
   * If canManage is false, only returns couriers assigned to the user or their department.
   */
  async list(options: {
    userId: string
    departmentId?: string
    canManage: boolean
    type?: 'incoming' | 'outgoing'
  }) {
    const baseQueries = [Query.orderDesc('$createdAt')]

    if (options.type) {
      baseQueries.push(Query.equal('type', options.type))
    }

    if (options.canManage) {
      const result = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        queries: baseQueries,
      })
      return result.documents.map((doc) => this.mapDocument(doc))
    }

    // If not a manager, filter by assignment
    const queries = [...baseQueries]

    // Construct OR query for assignment
    // Note: Appwrite 1.5+ supports Query.or
    const orQueries = [
      Query.and([Query.equal('assignedTo', options.userId), Query.equal('targetType', 'user')]),
    ]

    if (options.departmentId) {
      orQueries.push(
        Query.and([
          Query.equal('assignedTo', options.departmentId),
          Query.equal('targetType', 'department'),
        ])
      )
    }

    queries.push(Query.or(orQueries))

    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries,
    })

    return result.documents.map((doc) => this.mapDocument(doc))
  }

  /**
   * Get a single courier.
   */
  async get(courierId: string) {
    const doc = await appwrite.databases.getDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
    })

    return this.mapDocument(doc)
  }

  /**
   * Create a new courier record with optional file.
   */
  async create(
    payload: CreateCourierPayload,
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
          status: payload.type === 'incoming' ? 'pending' : 'sent',
        },
      })

      return this.mapDocument(doc)
    } catch (error) {
      // Cleanup orphaned file if document creation fails
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
   * Update a courier record.
   */
  async update(courierId: string, payload: UpdateCourierPayload) {
    const doc = await appwrite.databases.updateDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
      data: payload,
    })

    return this.mapDocument(doc)
  }

  /**
   * Upload a file for a courier and link it.
   */
  async uploadFile(courierId: string, tmpPath: string, fileName: string) {
    // 1. Upload to isolated bucket
    const file = InputFile.fromPath(tmpPath, fileName)
    const uploadedFile = await appwrite.storage.createFile({
      bucketId: this.bucketId,
      fileId: ID.unique(),
      file,
    })

    // 2. Link to courier document
    await appwrite.databases.updateDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
      data: {
        fileId: uploadedFile.$id,
      },
    })

    return uploadedFile
  }

  /**
   * Delete a courier and its associated file if it exists.
   */
  async delete(courierId: string) {
    const courier = await this.get(courierId)

    if (courier.fileId) {
      try {
        await appwrite.storage.deleteFile({
          bucketId: this.bucketId,
          fileId: courier.fileId,
        })
      } catch (error) {
        // Log error but continue deleting the document
      }
    }

    await appwrite.databases.deleteDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
    })
  }

  /**
   * Helper to map Appwrite document to our domain model.
   */
  private mapDocument(doc: any) {
    const fileUrl = doc.fileId
      ? `${appwriteConfig.endpoint}/storage/buckets/${this.bucketId}/files/${doc.fileId}/view?project=${appwriteConfig.projectId}`
      : null

    return {
      id: doc.$id,
      type: doc.type,
      subject: doc.subject,
      sender: doc.sender || null,
      recipient: doc.recipient || null,
      assignedTo: doc.assignedTo,
      targetType: doc.targetType,
      fileUrl,
      createdBy: doc.createdBy,
      status: doc.status,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt,
    }
  }
}
