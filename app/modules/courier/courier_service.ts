import appwriteConfig from '#config/appwrite'
import { Collections } from '#modules/_registry/collection_ids'
import { type CourierUrgency, CourierStatus, CourierType } from '#modules/courier/courier_enums'
import { ExternalContactService } from '#modules/external_contacts/external_contact_service'
import appwrite from '#services/appwrite_service'
import logger from '@adonisjs/core/services/logger'
import { ID, Query } from 'node-appwrite'

// ── Payload interfaces ────────────────────────────────────────────────

export interface CourierAssignment {
  entityId: string
  entityType: 'user' | 'department'
  entityName?: string | null
  entityEmail?: string | null
}

export interface CreateCourierPayload {
  type: CourierType
  urgency: CourierUrgency
  subject: string
  receivedAt?: string
  emittedAt?: string
  delivererName?: string
  delivererEmail?: string
  delivererPhone?: string
  correspondentId?: string
  targetType: 'user' | 'department'
  entityIds: string[]
  createdBy: string
  fileIds?: string[]
}

export interface UpdateCourierPayload {
  urgency?: CourierUrgency
  subject?: string
  receivedAt?: string
  emittedAt?: string
  delivererName?: string
  delivererEmail?: string
  delivererPhone?: string
  correspondentId?: string
  status?: CourierStatus
  isFavorite?: boolean
  isArchived?: boolean
}

// ── Service ───────────────────────────────────────────────────────────

/**
 * Service for managing couriers within an organisation's isolated database and bucket.
 */
export default class CourierService {
  private readonly databaseId: string
  private readonly bucketId: string
  private readonly teamId?: string
  private readonly collectionId = Collections.COURIERS
  private readonly assignmentsCollectionId = Collections.COURIER_ASSIGNMENTS

  /**
   * Initializes the CourierService with organization-specific resources.
   * @param databaseId - The ID of the organization's database.
   * @param bucketId - The ID of the organization's storage bucket.
   */
  constructor(databaseId: string, bucketId: string, teamId?: string) {
    this.databaseId = databaseId
    this.bucketId = bucketId
    this.teamId = teamId
  }

  /**
   * Factory method to initialize service for a specific organisation.
   * Retrieves organization preferences to get database and bucket IDs.
   * @param orgId - The ID of the organization.
   * @returns A promise that resolves to an instance of CourierService.
   * @throws Error if the organization does not have provisioned resources.
   */
  static async forOrg(orgId: string): Promise<CourierService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId || !prefs.bucketId) {
      throw new Error(`Organisation ${orgId} does not have provisioned resources.`)
    }
    return new CourierService(prefs.databaseId, prefs.bucketId, orgId)
  }

  // ── Assignment helpers ──────────────────────────────────────────────

  /**
   * Create assignment documents for a courier.
   * @param courierId - The courier to assign.
   * @param entityIds - Array of user or department IDs.
   * @param entityType - Whether the IDs are users or departments.
   * @param assignedBy - The user creating the assignments.
   */
  async createAssignments(
    courierId: string,
    entityIds: string[],
    entityType: CourierAssignment['entityType'],
    assignedBy: string
  ): Promise<CourierAssignment[]> {
    const assignments: CourierAssignment[] = []

    for (const entityId of entityIds) {
      const entityName = await this.resolveEntityName(entityId, entityType)

      await appwrite.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: this.assignmentsCollectionId,
        documentId: ID.unique(),
        data: {
          courierId,
          entityId,
          entityType,
          assignedBy,
        },
      })

      assignments.push({
        entityId,
        entityType,
        entityName: entityName ?? null,
      })
    }

    return assignments
  }

  /**
   * Get all assignments for a courier.
   * @param courierId - The courier ID.
   * @returns Array of assignment objects.
   */
  async getAssignments(courierId: string): Promise<CourierAssignment[]> {
    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.assignmentsCollectionId,
      queries: [Query.equal('courierId', courierId), Query.limit(100)],
    })

    return Promise.all(
      result.documents.map(async (doc: any) => {
        const entityName =
          doc.entityName ?? (await this.resolveEntityName(doc.entityId, doc.entityType))

        return {
          entityId: doc.entityId,
          entityType: doc.entityType,
          entityName: entityName ?? null,
          entityEmail: doc.entityEmail ?? null,
        }
      })
    )
  }

  /**
   * Delete all assignments for a courier.
   * @param courierId - The courier ID.
   */
  async deleteAssignments(courierId: string): Promise<void> {
    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.assignmentsCollectionId,
      queries: [Query.equal('courierId', courierId), Query.limit(100)],
    })

    for (const doc of result.documents) {
      await appwrite.databases.deleteDocument({
        databaseId: this.databaseId,
        collectionId: this.assignmentsCollectionId,
        documentId: doc.$id,
      })
    }
  }

  /**
   * Check if a user or department is assigned to a courier.
   */
  async isAssigned(
    courierId: string,
    entityId: string,
    entityType: 'user' | 'department'
  ): Promise<boolean> {
    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.assignmentsCollectionId,
      queries: [
        Query.equal('courierId', courierId),
        Query.equal('entityId', entityId),
        Query.equal('entityType', entityType),
        Query.limit(1),
      ],
    })
    return result.total > 0
  }

  // ── CRUD ────────────────────────────────────────────────────────────

  /**
   * List couriers for the organisation based on provided filters.
   * If canManage is false, only returns couriers assigned to the user or their department, or created by the user.
   * @param options - Filtering and pagination options.
   * @returns A list of couriers and the total count.
   */
  async list(options: {
    userId: string
    departmentId?: string
    canManage: boolean
    type?: CourierType
    archived?: boolean
    favorite?: boolean
    deleted?: boolean
    limit?: number
    page?: number
  }) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
    const page = Math.max(options.page ?? 1, 1)
    const offset = (page - 1) * limit

    const baseQueries = [
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset),
      ...(options.type ? [Query.equal('type', options.type)] : []),
      Query.equal('isArchived', options.archived ?? false),
      Query.equal('isDeleted', options.deleted ?? false),
      ...(options.favorite ? [Query.equal('isFavorite', true)] : []),
    ]

    if (options.canManage) {
      const result = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        queries: baseQueries,
      })
      return {
        total: result.total,
        documents: await Promise.all(
          result.documents.map((doc) => this.mapDocumentWithAssignments(doc))
        ),
      }
    }

    // If not a manager, find courier IDs the user/department is assigned to
    const assignmentQueries: any[] = []

    // User assignments
    assignmentQueries.push(
      Query.and([Query.equal('entityId', options.userId), Query.equal('entityType', 'user')])
    )

    // Department assignments
    if (options.departmentId) {
      assignmentQueries.push(
        Query.and([
          Query.equal('entityId', options.departmentId),
          Query.equal('entityType', 'department'),
        ])
      )
    }

    const assignmentResult = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.assignmentsCollectionId,
      queries: [Query.or(assignmentQueries), Query.limit(500)],
    })

    const assignedCourierIds = [
      ...new Set(assignmentResult.documents.map((doc: any) => doc.courierId)),
    ]

    // Build OR query: assigned courier IDs OR created by user
    const orQueries: any[] = [Query.equal('createdBy', options.userId)]

    if (assignedCourierIds.length > 0) {
      orQueries.push(Query.equal('$id', assignedCourierIds))
    }

    baseQueries.push(Query.or(orQueries))

    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: baseQueries,
    })

    return {
      total: result.total,
      documents: await Promise.all(
        result.documents.map((doc) => this.mapDocumentWithAssignments(doc))
      ),
    }
  }

  /**
   * Get a single courier by ID, including its assignments.
   * @param courierId - The ID of the courier to retrieve.
   * @returns The mapped courier document with assignments.
   */
  async get(courierId: string) {
    const doc = await appwrite.databases.getDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
    })

    return this.mapDocumentWithAssignments(doc)
  }

  /**
   * List couriers linked to a specific external contact.
   * Returns a lightweight summary suitable for contact detail views.
   */
  /**
   * List couriers linked to a specific correspondent.
   * Returns a lightweight summary suitable for correspondent detail views.
   */
  async listByCorrespondent(
    contactId: string,
    options: {
      limit?: number
      page?: number
      deleted?: boolean
      status?: string
      type?: string
    } = {}
  ) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
    const page = Math.max(options.page ?? 1, 1)
    const offset = (page - 1) * limit

    const queries = [
      Query.equal('correspondentId', contactId),
      Query.equal('isDeleted', options.deleted ?? false),
      ...(options.status ? [Query.equal('status', options.status)] : []),
      ...(options.type ? [Query.equal('type', options.type)] : []),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset),
    ]

    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries,
    })

    return {
      total: result.total,
      documents: await Promise.all(result.documents.map((doc: any) => this.mapContactCourier(doc))),
    }
  }

  /**
   * Create a new courier record, then create assignment documents for each entity ID.
   */
  async create(payload: CreateCourierPayload) {
    const fileIds = payload.fileIds?.filter(Boolean) ?? []

    const doc = await appwrite.databases.createDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: ID.unique(),
      data: {
        ...this.omitUndefined({
          type: payload.type,
          urgency: payload.urgency,
          subject: payload.subject,
          receivedAt: payload.receivedAt,
          emittedAt: payload.emittedAt,
          delivererName: payload.delivererName,
          delivererEmail: payload.delivererEmail,
          delivererPhone: payload.delivererPhone,
          correspondentId: payload.correspondentId,
          createdBy: payload.createdBy,
          targetType: payload.targetType,
          fileIds: fileIds.length > 0 ? fileIds : undefined,
        }),
        replyCount: 0,
        status: payload.type === CourierType.INCOMING ? CourierStatus.PENDING : CourierStatus.SENT,
        isFavorite: false,
        isArchived: false,
        isDeleted: false,
      },
    })

    const assignments = await this.createAssignments(
      doc.$id,
      payload.entityIds,
      payload.targetType,
      payload.createdBy
    )

    return this.mapDocument(doc, assignments)
  }

  /**
   * Update a courier record by ID.
   * Automatically archives the courier if the status is set to COMPLETED.
   * @param courierId - The ID of the courier to update.
   * @param payload - The fields to update.
   * @returns The updated and mapped courier document.
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

    return this.mapDocumentWithAssignments(doc)
  }

  /**
   * Prepare direct Appwrite upload targets for courier documents.
   */
  createUploadTargets(files: { fileName: string; fileExtension: string; size: number }[]) {
    return files.map(() => {
      const fileId = ID.unique()
      const uploadUrl = `${appwriteConfig.endpoint}/storage/buckets/${this.bucketId}/files`

      return {
        fileId,
        uploadUrl,
        method: 'POST',
        expiresInSeconds: 900,
        formData: {
          fileId,
          file: '<binary>',
        },
      }
    })
  }

  /**
   * Move a courier to the bin (soft delete) by setting isDeleted to true.
   * @param courierId - The ID of the courier to soft delete.
   * @returns The updated and mapped courier document.
   */
  async softDelete(courierId: string) {
    const doc = await appwrite.databases.updateDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
      data: { isDeleted: true },
    })
    return this.mapDocumentWithAssignments(doc)
  }

  /**
   * Restore a soft-deleted courier from the bin by setting isDeleted to false.
   * @param courierId - The ID of the courier to restore.
   * @returns The updated and mapped courier document.
   */
  async restore(courierId: string) {
    const doc = await appwrite.databases.updateDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
      data: { isDeleted: false },
    })
    return this.mapDocumentWithAssignments(doc)
  }

  /**
   * Permanently delete a courier, its assignments, and associated files.
   * @param courierId - The ID of the courier to permanently delete.
   * @throws Error if the courier or file cannot be deleted.
   */
  async forceDelete(courierId: string) {
    const courierDoc = await appwrite.databases.getDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
    })

    // Delete assignments first
    await this.deleteAssignments(courierId)

    const fileIds = Array.isArray(courierDoc.fileIds) ? courierDoc.fileIds.filter(Boolean) : []

    for (const fileId of fileIds) {
      try {
        await appwrite.storage.deleteFile({ bucketId: this.bucketId, fileId })
      } catch (error) {
        logger.warn({ courierId, fileId, error }, 'Failed to delete courier file')
      }
    }

    await appwrite.databases.deleteDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: courierId,
    })
  }

  // ── Mapping helpers ─────────────────────────────────────────────────

  /**
   * Map document and fetch its assignments in one call.
   */
  private async mapDocumentWithAssignments(doc: any) {
    const assignments = await this.getAssignments(doc.$id)
    return this.mapDocument(doc, assignments)
  }

  /**
   * Helper to map an Appwrite document to our domain model.
   * Calculates public view URLs for file attachments if they exist.
   * @param doc - The raw Appwrite document.
   * @param assignments - Pre-fetched assignment list.
   * @returns The formatted domain model object.
   */
  private async resolveCorrespondentDetails(doc: any) {
    if (doc.correspondentId) {
      try {
        const contactService = new ExternalContactService(this.databaseId)
        const contact = await contactService.get(doc.correspondentId)

        return {
          id: doc.correspondentId,
          type: contact.structureType ?? 'external_contact',
          name: contact.name ?? null,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
        }
      } catch {
        return {
          id: doc.correspondentId,
          type: 'external_contact',
          name: null,
          email: null,
          phone: null,
        }
      }
    }

    return null
  }

  private resolveDelivererDetails(doc: any) {
    if (doc.delivererName || doc.delivererEmail || doc.delivererPhone) {
      return {
        name: doc.delivererName ?? null,
        email: doc.delivererEmail ?? null,
        phone: doc.delivererPhone ?? null,
      }
    }

    return null
  }

  private async resolveEntityName(
    entityId: string,
    entityType: CourierAssignment['entityType']
  ): Promise<string | null> {
    if (entityType === 'department') {
      try {
        const department = await appwrite.databases.getDocument({
          databaseId: this.databaseId,
          collectionId: Collections.DEPARTMENTS,
          documentId: entityId,
        })

        return department?.name ?? null
      } catch {
        // fall through to external contacts lookup below
      }
    }

    if (entityType === 'user') {
      try {
        const user = await appwrite.users.get({ userId: entityId })
        return user?.name ?? user?.email ?? null
      } catch {
        if (this.teamId) {
          try {
            const memberships = await appwrite.teams.listMemberships({
              teamId: this.teamId,
              queries: [Query.equal('userId', entityId)],
            })

            const membership = memberships.memberships?.[0]
            return membership?.userName ?? membership?.userEmail ?? null
          } catch {
            // fall through to external contacts lookup below
          }
        }
      }
    }

    try {
      const contact = await appwrite.databases.getDocument({
        databaseId: this.databaseId,
        collectionId: Collections.EXTERNAL_CONTACTS,
        documentId: entityId,
      })

      return contact?.name ?? null
    } catch {
      return null
    }
  }

  private async enrichAssignment(assignment: CourierAssignment) {
    if (assignment.entityName) {
      return assignment
    }

    const entityName = await this.resolveEntityName(assignment.entityId, assignment.entityType)

    if (assignment.entityType === 'user') {
      try {
        const user = await appwrite.users.get({ userId: assignment.entityId })
        return {
          ...assignment,
          entityName: entityName ?? user?.name ?? user?.email ?? null,
          entityEmail: user?.email ?? null,
        }
      } catch {
        return {
          ...assignment,
          entityName: entityName ?? null,
        }
      }
    }

    return {
      ...assignment,
      entityName: entityName ?? null,
    }
  }

  private async mapDocument(doc: any, assignments: CourierAssignment[]) {
    const fileIds = Array.isArray(doc.fileIds) ? doc.fileIds.filter(Boolean) : []
    const fileUrls = fileIds.map(
      (id: string) =>
        `${appwriteConfig.endpoint}/storage/buckets/${this.bucketId}/files/${id}/view?project=${appwriteConfig.projectId}`
    )
    const correspondent = await this.resolveCorrespondentDetails(doc)
    const deliverer = this.resolveDelivererDetails(doc)
    const enrichedAssignments = await Promise.all(
      assignments.map((assignment) => this.enrichAssignment(assignment))
    )

    return {
      id: doc.$id,
      type: doc.type,
      urgency: doc.urgency,
      subject: doc.subject,
      receivedAt: doc.receivedAt || null,
      emittedAt: doc.emittedAt || null,
      correspondent,
      deliverer,
      targetType: doc.targetType || null,
      assignments: enrichedAssignments,
      fileUrls,
      createdBy: doc.createdBy,
      status: doc.status,
      isFavorite: doc.isFavorite ?? false,
      isArchived: doc.isArchived ?? false,
      isDeleted: doc.isDeleted ?? false,
      replyCount: doc.replyCount ?? 0,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt,
    }
  }

  private async mapContactCourier(doc: any) {
    const assignments = await this.getAssignments(doc.$id)
    const enrichedAssignments = await Promise.all(
      assignments.map((assignment) => this.enrichAssignment(assignment))
    )

    return {
      id: doc.$id,
      subject: doc.subject,
      date: doc.emittedAt || doc.receivedAt || doc.$createdAt || null,
      type: doc.type,
      state: doc.status,
      assignments: enrichedAssignments.map((assignment) => ({
        entityType: assignment.entityType,
        entityName: assignment.entityName,
      })),
    }
  }

  private omitUndefined<T extends Record<string, any>>(data: T) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
  }
}
