import { Collections } from '#modules/_registry/collection_ids'
import appwrite from '#services/appwrite_service'
import { ID, Query } from 'node-appwrite'

/**
 * Service for managing departments within an organisation's isolated database.
 * All operations target the org-specific database, identified by databaseId
 * stored in team preferences.
 */
export default class DepartmentsService {
  private readonly databaseId: string
  private readonly collectionId = Collections.DEPARTMENTS

  constructor(databaseId: string) {
    this.databaseId = databaseId
  }

  /**
   * Resolve the org's databaseId from team preferences and initialize the service.
   * @param orgId - The ID of the organisation (team).
   * @returns A new instance of DepartmentsService configured for the organisation.
   */
  static async forOrg(orgId: string): Promise<DepartmentsService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId) {
      throw new Error(`Organisation ${orgId} does not have a provisioned database.`)
    }
    return new DepartmentsService(prefs.databaseId)
  }

  /**
   * List departments for the organisation with pagination, including member and courier counts.
   * Fires parallel queries to minimise latency.
   * @param options - Pagination options.
   * @returns A paginated result containing departments and the total count.
   */
  async list(options: { limit?: number; page?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
    const page = Math.max(options.page ?? 1, 1)
    const offset = (page - 1) * limit

    const [deptResult, profilesResult, currentCouriersResult, assignmentResult] = await Promise.all(
      [
        // 1. Departments paginated query
        appwrite.databases.listDocuments({
          databaseId: this.databaseId,
          collectionId: this.collectionId,
          queries: [Query.orderAsc('name'), Query.limit(limit), Query.offset(offset)],
        }),
        // 2. All org profiles — lightweight, only need departmentId
        appwrite.databases.listDocuments({
          databaseId: this.databaseId,
          collectionId: Collections.ORG_PROFILES,
          queries: [Query.select(['departmentId']), Query.limit(5000)],
        }),
        // 3. Legacy department courier links stored on the courier document
        appwrite.databases.listDocuments({
          databaseId: this.databaseId,
          collectionId: Collections.COURIERS,
          queries: [
            Query.equal('targetType', 'department'),
            Query.equal('isDeleted', false),
            Query.select(['internalEntityId']),
            Query.limit(5000),
          ],
        }),
        // 4. Current department assignments stored in the assignments collection
        appwrite.databases.listDocuments({
          databaseId: this.databaseId,
          collectionId: Collections.COURIER_ASSIGNMENTS,
          queries: [
            Query.equal('entityType', 'department'),
            Query.select(['entityId']),
            Query.limit(5000),
          ],
        }),
      ]
    )

    // Build count maps: departmentId → count
    const membersCountMap = new Map<string, number>()
    for (const doc of profilesResult.documents) {
      const deptId = doc.departmentId as string
      membersCountMap.set(deptId, (membersCountMap.get(deptId) ?? 0) + 1)
    }

    const couriersCountMap = new Map<string, number>()
    for (const doc of currentCouriersResult.documents) {
      const deptId = doc.internalEntityId as string | undefined
      if (deptId) {
        couriersCountMap.set(deptId, (couriersCountMap.get(deptId) ?? 0) + 1)
      }
    }

    for (const doc of assignmentResult.documents) {
      const deptId = doc.entityId as string | undefined
      if (deptId) {
        couriersCountMap.set(deptId, (couriersCountMap.get(deptId) ?? 0) + 1)
      }
    }

    const documents = deptResult.documents.map((row) => ({
      id: row.$id,
      name: row.name,
      description: row.description || null,
      managerUserId: row.managerUserId || null,
      membersCount: membersCountMap.get(row.$id) ?? 0,
      couriersCount: couriersCountMap.get(row.$id) ?? 0,
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt,
    }))

    return {
      total: deptResult.total,
      documents,
    }
  }

  /**
   * Get a single department by ID, including member and courier counts.
   * @param departmentId - The ID of the department.
   * @returns The department details with membersCount and couriersCount.
   */
  async get(departmentId: string) {
    const [row, profilesResult, couriersResult, assignmentResult] = await Promise.all([
      appwrite.databases.getDocument({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        documentId: departmentId,
      }),
      appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: Collections.ORG_PROFILES,
        queries: [Query.equal('departmentId', departmentId), Query.select(['$id']), Query.limit(1)],
      }),
      appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: Collections.COURIERS,
        queries: [
          Query.equal('internalEntityId', departmentId),
          Query.equal('targetType', 'department'),
          Query.equal('isDeleted', false),
          Query.select(['$id']),
          Query.limit(1),
        ],
      }),
      appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: Collections.COURIER_ASSIGNMENTS,
        queries: [
          Query.equal('entityType', 'department'),
          Query.equal('entityId', departmentId),
          Query.select(['$id']),
          Query.limit(1000),
        ],
      }),
    ])

    return {
      id: row.$id,
      name: row.name,
      description: row.description || null,
      managerUserId: row.managerUserId || null,
      membersCount: profilesResult.total,
      couriersCount: couriersResult.total + assignmentResult.total,
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt,
    }
  }

  /**
   * Create a new department.
   * @param data - The department details (name, description, manager).
   * @returns The created department details.
   */
  async create(data: { name: string; description?: string; managerUserId?: string }) {
    const row = await appwrite.databases.createDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: ID.unique(),
      data: {
        name: data.name,
        description: data.description ?? '',
        managerUserId: data.managerUserId ?? '',
      },
    })

    return {
      id: row.$id,
      name: row.name,
      description: row.description || null,
      managerUserId: row.managerUserId || null,
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt,
    }
  }

  /**
   * Update an existing department.
   * @param departmentId - The ID of the department to update.
   * @param data - The fields to update.
   * @returns The updated department details.
   */
  async update(
    departmentId: string,
    data: { name?: string; description?: string; managerUserId?: string }
  ) {
    const updateData: Record<string, any> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.managerUserId !== undefined) updateData.managerUserId = data.managerUserId

    const row = await appwrite.databases.updateDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: departmentId,
      data: updateData,
    })

    return {
      id: row.$id,
      name: row.name,
      description: row.description || null,
      managerUserId: row.managerUserId || null,
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt,
    }
  }

  /**
   * Delete a department.
   * @param departmentId - The ID of the department to delete.
   */
  async delete(departmentId: string) {
    await appwrite.databases.deleteDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: departmentId,
    })
  }
}
