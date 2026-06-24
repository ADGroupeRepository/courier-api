import { Collections } from '#modules/_registry/collection_ids'
import appwrite from '#services/appwrite_service'
import { ID, Query } from 'node-appwrite'

export interface AssignMemberPayload {
  userId: string
  membershipId: string
  departmentId: string
  jobTitle?: string
  departmentRole?: 'manager' | 'member'
}

/**
 * Service for managing organisation profiles (linking users to departments).
 */
export default class MembersService {
  public readonly databaseId: string
  private readonly teamId: string
  private readonly collectionId = Collections.ORG_PROFILES

  constructor(databaseId: string, teamId: string) {
    this.databaseId = databaseId
    this.teamId = teamId
  }

  /**
   * Factory method to initialize service for a specific organisation.
   * @param orgId - The ID of the organisation (team).
   * @returns A new instance of MembersService configured for the organisation.
   */
  static async forOrg(orgId: string): Promise<MembersService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId) {
      throw new Error(`Organisation ${orgId} does not have a provisioned database.`)
    }
    return new MembersService(prefs.databaseId, orgId)
  }

  /**
   * Assign a user to a department by creating an org_profile record.
   * A user may belong to multiple departments, but only once per department.
   * @param payload - The assignment details (user, department, role, title).
   * @returns The created or updated profile document.
   */
  async assignToDepartment(payload: AssignMemberPayload) {
    // Check if this user is already assigned to the same department.
    const existing = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [
        Query.equal('userId', payload.userId),
        Query.equal('departmentId', payload.departmentId),
      ],
    })

    const data = {
      userId: payload.userId,
      membershipId: payload.membershipId,
      departmentId: payload.departmentId,
      jobTitle: payload.jobTitle ?? '',
      departmentRole: payload.departmentRole ?? 'member',
    }

    if (existing.total > 0) {
      throw new Error('User is already assigned to this department.')
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
   * List members assigned to a specific department with pagination.
   * @param departmentId - The ID of the department.
   * @param options - Pagination options.
   * @returns A paginated list of member profiles in the department.
   */
  async listByDepartment(departmentId: string, options: { limit?: number; page?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
    const page = Math.max(options.page ?? 1, 1)
    const offset = (page - 1) * limit

    const result = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [
        Query.equal('departmentId', departmentId),
        Query.limit(limit),
        Query.offset(offset),
      ],
    })

    const memberships = await appwrite.teams.listMemberships({ teamId: this.teamId })
    const membershipsById = new Map(memberships.memberships.map((member) => [member.$id, member]))
    const membershipsByUserId = new Map(
      memberships.memberships.map((member) => [member.userId, member])
    )

    const documents = result.documents.map((doc) => ({
      ...this.serializeProfile(doc, membershipsById, membershipsByUserId),
    }))

    return {
      total: result.total,
      documents,
    }
  }

  /**
   * List departments assigned to a user in the organisation.
   * @param userId - The user ID.
   * @returns A list of departments with their public profile shape.
   */
  async listDepartmentsForUser(userId: string) {
    const profiles = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [Query.equal('userId', userId), Query.limit(5000)],
    })

    const departmentIds = [
      ...new Set(profiles.documents.map((profile) => profile.departmentId as string)),
    ]
    const profileByDepartmentId = new Map(
      profiles.documents.map((profile) => [profile.departmentId as string, profile])
    )

    const departmentResults = await Promise.allSettled(
      departmentIds.map((departmentId) =>
        appwrite.databases.getDocument({
          databaseId: this.databaseId,
          collectionId: Collections.DEPARTMENTS,
          documentId: departmentId,
        })
      )
    )

    return departmentResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map((result) => ({
        id: result.value.$id,
        name: result.value.name,
        role: profileByDepartmentId.get(result.value.$id)?.departmentRole ?? 'member',
      }))
  }

  /**
   * Remove a member from their department (deletes their org_profile).
   * @param id - The user ID or the profile document ID.
   */
  async removeFromDepartment(id: string) {
    const list = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [Query.equal('userId', id)],
    })

    if (list.total > 0) {
      await appwrite.databases.deleteDocument({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        documentId: list.documents[0].$id,
      })
    } else {
      // Fallback: treat the ID directly as the document ID
      await appwrite.databases.deleteDocument({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        documentId: id,
      })
    }
  }

  /**
   * Update a member's department role.
   * @param userId - The user ID.
   * @param departmentRole - The new department role.
   */
  async updateDepartmentRole(userId: string, departmentRole: 'manager' | 'member') {
    const list = await appwrite.databases.listDocuments({
      databaseId: this.databaseId,
      collectionId: this.collectionId,
      queries: [Query.equal('userId', userId)],
    })

    if (list.total > 0) {
      await Promise.all(
        list.documents.map(async (doc) => {
          await appwrite.databases.updateDocument({
            databaseId: this.databaseId,
            collectionId: this.collectionId,
            documentId: doc.$id,
            data: {
              departmentRole,
            },
          })

          if (departmentRole === 'manager') {
            await appwrite.databases.updateDocument({
              databaseId: this.databaseId,
              collectionId: Collections.DEPARTMENTS,
              documentId: doc.departmentId,
              data: {
                managerUserId: userId,
              },
            })
          }
        })
      )
    } else {
      throw new Error('User does not have a department profile to update.')
    }
  }

  private serializeProfile(
    doc: any,
    membershipsById: Map<string, any>,
    membershipsByUserId: Map<string, any>
  ) {
    const membership = membershipsById.get(doc.membershipId) || membershipsByUserId.get(doc.userId)

    return {
      id: doc.$id,
      userId: doc.userId,
      userName: membership?.userName ?? null,
      userEmail: membership?.userEmail ?? null,
      roles: membership?.roles ?? [],
      departmentId: doc.departmentId,
      jobTitle: doc.jobTitle || null,
      departmentRole: doc.departmentRole,
      createdAt: doc.$createdAt,
    }
  }
}
