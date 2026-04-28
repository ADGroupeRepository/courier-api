import appwrite from '#services/appwrite_service'
import { ID, Query } from 'node-appwrite'

/**
 * Service for managing departments within an organisation's isolated database.
 * All operations target the org-specific database, identified by databaseId
 * stored in team preferences.
 */
export default class DepartmentsService {
  private readonly databaseId: string
  private readonly collectionId = 'departments'

  constructor(databaseId: string) {
    this.databaseId = databaseId
  }

  /**
   * Resolve the org's databaseId from team preferences.
   * Use this factory method instead of manually constructing.
   */
  static async forOrg(orgId: string): Promise<DepartmentsService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId) {
      throw new Error(`Organisation ${orgId} does not have a provisioned database.`)
    }
    return new DepartmentsService(prefs.databaseId)
  }

  /**
   * List all departments for the organisation.
   */
  async list() {
    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [Query.orderAsc('name'), Query.limit(100)],
    })

    return result.documents.map((row) => ({
      id: row.$id,
      name: row.name,
      description: row.description || null,
      managerUserId: row.managerUserId || null,
      createdAt: row.$createdAt,
      updatedAt: row.$updatedAt,
    }))
  }

  /**
   * Get a single department by ID.
   */
  async get(departmentId: string) {
    const row = await appwrite.databases.getDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: departmentId,
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
   * Create a new department.
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
   * Update a department.
   */
  async update(departmentId: string, data: { name?: string; description?: string; managerUserId?: string }) {
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
   */
  async delete(departmentId: string) {
    await appwrite.databases.deleteDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: departmentId,
    })
  }
}
