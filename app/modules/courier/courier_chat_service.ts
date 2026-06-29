import appwrite from '#services/appwrite_service'
import appwriteConfig from '#config/appwrite'
import { ID, Query, Permission, Role } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import { Collections } from '#modules/_registry/collection_ids'
import logger from '@adonisjs/core/services/logger'
import MembersService from '#modules/directory/members_service'

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
  private readonly orgId: string
  private readonly collectionId = Collections.COURIER_MESSAGES

  /**
   * Initializes the CourierChatService with organization-specific resources.
   */
  constructor(databaseId: string, bucketId: string, orgId: string) {
    this.databaseId = databaseId
    this.bucketId = bucketId
    this.orgId = orgId
  }

  /**
   * Factory method to initialize service for a specific organisation.
   */
  static async forOrg(orgId: string): Promise<CourierChatService> {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId || !prefs.bucketId) {
      throw new Error(`Organisation ${orgId} does not have provisioned resources.`)
    }
    return new CourierChatService(prefs.databaseId, prefs.bucketId, orgId)
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
      // 1. Get the parent courier to resolve creator, handler, and assignments
      const courierDoc = await appwrite.databases.getDocument({
        databaseId: this.databaseId,
        collectionId: Collections.COURIERS,
        documentId: payload.courierId,
      })

      // Fetch all assignments for this courier
      const assignmentsResult = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: Collections.COURIER_ASSIGNMENTS,
        queries: [Query.equal('courierId', payload.courierId), Query.limit(100)],
      })

      const allowedUsers = new Set<string>()
      if (courierDoc.createdBy) allowedUsers.add(courierDoc.createdBy)
      if (courierDoc.handlerUserId) allowedUsers.add(courierDoc.handlerUserId)

      for (const assignment of assignmentsResult.documents) {
        if (assignment.entityType === 'user') {
          allowedUsers.add(assignment.entityId)
        } else if (assignment.entityType === 'department') {
          try {
            const membersService = await MembersService.forOrg(this.orgId)
            const deptMembers = await membersService.listByDepartment(assignment.entityId)
            for (const m of deptMembers.documents) {
              allowedUsers.add(m.userId)
            }
          } catch (err) {
            logger.warn(
              { err, deptId: assignment.entityId },
              'Failed to fetch department members for message permissions'
            )
          }
        }
      }

      // Allow creator/handler/assignees to read/write, and admins/secretariat
      const permissions: string[] = [
        Permission.read(Role.team(this.orgId, 'admin')),
        Permission.read(Role.team(this.orgId, 'secretariat')),
        Permission.write(Role.team(this.orgId, 'admin')),
        Permission.write(Role.team(this.orgId, 'secretariat')),
      ]

      for (const userId of allowedUsers) {
        permissions.push(Permission.read(Role.user(userId)))
        permissions.push(Permission.write(Role.user(userId)))
      }

      // 2. Create the message document in Appwrite
      const doc = await appwrite.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        documentId: ID.unique(),
        data: {
          ...payload,
          fileId: fileId || null,
          createdAt: new Date().toISOString(),
        },
        permissions,
      })

      // 3. Increment parent courier replyCount
      const currentReplyCount = courierDoc.replyCount ?? 0
      await appwrite.databases.updateDocument({
        databaseId: this.databaseId,
        collectionId: Collections.COURIERS,
        documentId: payload.courierId,
        data: {
          replyCount: currentReplyCount + 1,
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
