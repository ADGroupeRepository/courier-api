import appwrite from '#services/appwrite_service'
import logger from '@adonisjs/core/services/logger'
import appwriteConfig from '#config/appwrite'
import { ID, Query } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import { CourierUrgency, CourierStatus, CourierType, CourierStructureType } from '#modules/courier/courier_enums'
import { Collections } from '#modules/_registry/collection_ids'

export interface CreateCourierPayload {
  type: CourierType
  urgency: CourierUrgency
  subject: string
  contactName: string
  contactNumber: string
  contactStructureType?: CourierStructureType
  contactStructureName?: string
  contactIdNumber?: string
  contactPhone?: string
  contactEmail?: string
  externalContactId?: string
  internalEntityId: string
  targetType: 'user' | 'department'
  createdBy: string
}

export interface UpdateCourierPayload {
  urgency?: CourierUrgency
  subject?: string
  contactName?: string
  contactNumber?: string
  contactStructureType?: CourierStructureType
  contactStructureName?: string
  contactIdNumber?: string
  contactPhone?: string
  contactEmail?: string
  externalContactId?: string
  internalEntityId?: string
  targetType?: 'user' | 'department'
  status?: CourierStatus
  isFavorite?: boolean
  isArchived?: boolean
}

/**
 * Service for managing couriers within an organisation's isolated database and bucket.
 */
export default class CourierService {
  private readonly databaseId: string
  private readonly bucketId: string
  private readonly collectionId = Collections.COURIERS

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
    type?: CourierType
    archived?: boolean
    favorite?: boolean
    limit?: number
    offset?: number
  }) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
    const offset = Math.max(options.offset ?? 0, 0)

    const baseQueries = [
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset),
    ]

    if (options.type) {
      baseQueries.push(Query.equal('type', options.type))
    }

    // Filter by archive status (default: show non-archived)
    baseQueries.push(Query.equal('isArchived', options.archived ?? false))

    // Filter favorites only when explicitly requested
    if (options.favorite) {
      baseQueries.push(Query.equal('isFavorite', true))
    }

    if (options.canManage) {
      const result = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        queries: baseQueries,
      })
      return {
        total: result.total,
        documents: result.documents.map((doc) => this.mapDocument(doc)),
      }
    }

    // If not a manager, filter by assignment
    const queries = [...baseQueries]

    // Construct OR query for assignment
    // Note: Appwrite 1.5+ supports Query.or
    const orQueries = [
      Query.and([Query.equal('internalEntityId', options.userId), Query.equal('targetType', 'user')]),
      Query.equal('createdBy', options.userId),
    ]

    if (options.departmentId) {
      orQueries.push(
        Query.and([
          Query.equal('internalEntityId', options.departmentId),
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

    return {
      total: result.total,
      documents: result.documents.map((doc) => this.mapDocument(doc)),
    }
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
          status: payload.type === CourierType.INCOMING ? CourierStatus.PENDING : CourierStatus.SENT,
          isFavorite: false,
          isArchived: false,
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
    // Auto-archive when status is set to completed
    const data: Record<string, any> = { ...payload }
    if (payload.status === CourierStatus.COMPLETED) {
      data.isArchived = true
    }

    const doc = await appwrite.databases.updateDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
      data,
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
        logger.warn({ courierId, fileId: courier.fileId, error }, 'Failed to delete courier file, continuing with document deletion')
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
      urgency: doc.urgency,
      subject: doc.subject,
      contactName: doc.contactName,
      contactNumber: doc.contactNumber,
      contactStructureType: doc.contactStructureType || null,
      contactStructureName: doc.contactStructureName || null,
      contactIdNumber: doc.contactIdNumber || null,
      contactPhone: doc.contactPhone || null,
      contactEmail: doc.contactEmail || null,
      externalContactId: doc.externalContactId || null,
      internalEntityId: doc.internalEntityId,
      targetType: doc.targetType,
      fileUrl,
      fileId: doc.fileId || null,
      createdBy: doc.createdBy,
      status: doc.status,
      isFavorite: doc.isFavorite ?? false,
      isArchived: doc.isArchived ?? false,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt,
    }
  }
}
