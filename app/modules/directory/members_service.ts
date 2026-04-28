import appwrite from '#services/appwrite_service'
import { ID, Query } from 'node-appwrite'

export interface AssignMemberPayload {
  userId: string
  membershipId: string
  departmentId: string
  jobTitle?: string
  departmentRole: 'manager' | 'member'
}

/**
 * Service for managing organisation profiles (linking users to departments).
 */
export default class MembersService {
  private readonly databaseId: string
  private readonly collectionId = 'org_profiles'

  constructor(databaseId: string) {
    this.databaseId = databaseId
  }

  /**
   * Factory method to initialize service for a specific organisation.
   */
  static async forOrg(orgId: string): Promise<MembersService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId) {
      throw new Error(`Organisation ${orgId} does not have a provisioned database.`)
    }
    return new MembersService(prefs.databaseId)
  }

  /**
   * Assign a user to a department by creating an org_profile record.
   * If they already have a profile, it updates it (one profile per org/user).
   */
  async assignToDepartment(payload: AssignMemberPayload) {
    // 1. Check if a profile already exists for this user in this org
    const existing = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [Query.equal('userId', payload.userId)],
    })

    const data = {
      userId: payload.userId,
      membershipId: payload.membershipId,
      departmentId: payload.departmentId,
      jobTitle: payload.jobTitle ?? '',
      departmentRole: payload.departmentRole,
    }

    if (existing.total > 0) {
      // Update existing profile
      return appwrite.databases.updateDocument({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        documentId: existing.documents[0].$id,
        data,
      })
    }

    // Create new profile
    return appwrite.databases.createDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: ID.unique(),
      data,
    })
  }

  /**
   * List all members assigned to a specific department.
   */
  async listByDepartment(departmentId: string) {
    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [Query.equal('departmentId', departmentId)],
    })

    return result.documents.map((doc) => ({
      id: doc.$id,
      userId: doc.userId,
      membershipId: doc.membershipId,
      departmentId: doc.departmentId,
      jobTitle: doc.jobTitle || null,
      departmentRole: doc.departmentRole,
      createdAt: doc.$createdAt,
      updatedAt: doc.$updatedAt,
    }))
  }

  /**
   * Remove a member from their department (deletes their org_profile).
   */
  async removeFromDepartment(profileId: string) {
    await appwrite.databases.deleteDocument({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      documentId: profileId,
    })
  }
}
