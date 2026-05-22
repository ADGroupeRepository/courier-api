import type { HttpContext } from '@adonisjs/core/http'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'
import { Collections } from '#modules/_registry/collection_ids'
import { deleteNotificationsValidator } from '#modules/directory/notifications_validator'

/**
 * Controller for managing In-App Notifications.
 *
 * Listing / real-time fetching is handled directly by the client via
 * the Appwrite client SDK and its Realtime WebSocket subscription.
 * This controller only exposes server-side "mark as read" actions.
 *
 * Protected by AuthMiddleware and directory ModuleGuard.
 */
export default class NotificationsController {
  /**
   * PATCH /api/v1/organisations/:orgId/notifications/:id/read
   * Mark a single notification as read.
   */
  async markAsRead({ user, params, response }: HttpContext) {
    const orgId = params.orgId
    const notificationId = params.id
    const userId = user?.$id

    if (!userId) {
      return response.unauthorized({ message: 'User is not authenticated' })
    }

    try {
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      if (!prefs.databaseId) {
        return response.badRequest({ message: 'Organisation does not have a provisioned database' })
      }
      const databaseId = prefs.databaseId

      // Retrieve the document first to verify ownership
      const doc = await appwrite.databases.getDocument({
        databaseId,
        collectionId: Collections.NOTIFICATIONS,
        documentId: notificationId,
      })

      if (doc.userId !== userId) {
        return response.forbidden({ message: 'Forbidden: You do not own this notification' })
      }

      const updated = await appwrite.databases.updateDocument({
        databaseId,
        collectionId: Collections.NOTIFICATIONS,
        documentId: notificationId,
        data: {
          isRead: true,
        },
      })

      return response.ok({
        data: {
          id: updated.$id,
          userId: updated.userId,
          title: updated.title,
          body: updated.body,
          link: updated.link || null,
          isRead: updated.isRead,
          createdAt: updated.createdAt,
        },
      })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Notification not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PATCH /api/v1/organisations/:orgId/notifications/read-all
   * Mark all unread notifications for the user as read.
   */
  async markAllAsRead({ user, params, response }: HttpContext) {
    const orgId = params.orgId
    const userId = user?.$id

    if (!userId) {
      return response.unauthorized({ message: 'User is not authenticated' })
    }

    try {
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      if (!prefs.databaseId) {
        return response.badRequest({ message: 'Organisation does not have a provisioned database' })
      }
      const databaseId = prefs.databaseId

      // List up to 100 unread notifications to mark as read
      const unreadList = await appwrite.databases.listDocuments({
        databaseId,
        collectionId: Collections.NOTIFICATIONS,
        queries: [
          Query.equal('userId', userId),
          Query.equal('isRead', false),
          Query.limit(100),
        ],
      })

      // Chunk the updates into batches of 10 to avoid HTTP connection limits and rate-limiting
      const chunkArray = <T>(arr: T[], size: number): T[][] => {
        const result: T[][] = []
        for (let i = 0; i < arr.length; i += size) {
          result.push(arr.slice(i, i + size))
        }
        return result
      }

      const batches = chunkArray(unreadList.documents, 10)
      let count = 0
      for (const batch of batches) {
        await Promise.all(
          batch.map((doc) =>
            appwrite.databases.updateDocument({
              databaseId,
              collectionId: Collections.NOTIFICATIONS,
              documentId: doc.$id,
              data: {
                isRead: true,
              },
            })
          )
        )
        count += batch.length
      }

      return response.ok({
        message: 'All notifications marked as read successfully',
        count,
      })

    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/notifications/:id
   * Delete a single notification.
   */
  async destroy({ user, params, response }: HttpContext) {
    const orgId = params.orgId
    const notificationId = params.id
    const userId = user?.$id

    if (!userId) {
      return response.unauthorized({ message: 'User is not authenticated' })
    }

    try {
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      if (!prefs.databaseId) {
        return response.badRequest({ message: 'Organisation does not have a provisioned database' })
      }
      const databaseId = prefs.databaseId

      // Retrieve the document first to verify ownership
      const doc = await appwrite.databases.getDocument({
        databaseId,
        collectionId: Collections.NOTIFICATIONS,
        documentId: notificationId,
      })

      if (doc.userId !== userId) {
        return response.forbidden({ message: 'Forbidden: You do not own this notification' })
      }

      await appwrite.databases.deleteDocument({
        databaseId,
        collectionId: Collections.NOTIFICATIONS,
        documentId: notificationId,
      })

      return response.noContent()
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Notification not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/notifications
   * Delete multiple notifications.
   */
  async destroyMany({ request, user, params, response }: HttpContext) {
    const orgId = params.orgId
    const userId = user?.$id

    if (!userId) {
      return response.unauthorized({ message: 'User is not authenticated' })
    }

    try {
      const { ids } = await request.validateUsing(deleteNotificationsValidator)

      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      if (!prefs.databaseId) {
        return response.badRequest({ message: 'Organisation does not have a provisioned database' })
      }
      const databaseId = prefs.databaseId

      // Helper function to chunk array
      const chunkArray = <T>(arr: T[], size: number): T[][] => {
        const result: T[][] = []
        for (let i = 0; i < arr.length; i += size) {
          result.push(arr.slice(i, i + size))
        }
        return result
      }

      // First, retrieve and verify ownership of all notifications to be deleted
      // We do this in chunks of 10 to check permissions securely
      const idChunks = chunkArray(ids, 10)
      for (const chunk of idChunks) {
        const docs = await Promise.all(
          chunk.map((id) =>
            appwrite.databases.getDocument({
              databaseId,
              collectionId: Collections.NOTIFICATIONS,
              documentId: id,
            }).catch((err) => {
              if (err.code === 404) return null
              throw err
            })
          )
        )

        for (const doc of docs) {
          if (!doc) continue
          if (doc.userId !== userId) {
            return response.forbidden({ message: `Forbidden: You do not own notification ${doc.$id}` })
          }
        }
      }

      // Perform chunked bulk deletion (batches of 10)
      for (const chunk of idChunks) {
        await Promise.all(
          chunk.map((id) =>
            appwrite.databases.deleteDocument({
              databaseId,
              collectionId: Collections.NOTIFICATIONS,
              documentId: id,
            }).catch((err) => {
              // Ignore not found during deletion
              if (err.code === 404) return
              throw err
            })
          )
        )
      }

      return response.noContent()
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }
}

