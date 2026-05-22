import logger from '@adonisjs/core/services/logger'
import appwrite from '#services/appwrite_service'
import { Query, ID, Permission, Role } from 'node-appwrite'
import MembersService from '#modules/directory/members_service'
import { Collections } from '#modules/_registry/collection_ids'

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

export interface NotificationPayload {
  userId: string
  title: string
  body: string
  link?: string
}

/**
 * Service for dispatching emails and in-app notifications.
 * Currently a stub for a future integration like SendGrid, AWS SES, or Appwrite Messaging.
 */
export default class NotificationService {
  /**
   * Helper to retrieve a user's email by their ID and organisation.
   */
  static async getEmailByUserId(orgId: string, userId: string): Promise<string | null> {
    try {
      const memberships = await appwrite.teams.listMemberships({
        teamId: orgId,
        queries: [Query.equal('userId', userId)],
      })
      if (memberships.total > 0) {
        return memberships.memberships[0].userEmail
      }
    } catch (err: any) {
      logger.error({ err, orgId, userId }, 'Failed to fetch user email for notification')
    }
    return null
  }

  /**
   * Send an email notification.
   */
  static async sendEmail(payload: EmailPayload): Promise<void> {
    // TODO: Implement actual email sending logic (e.g., via SMTP or a third-party service)
    logger.info({ payload }, 'Mock Email Dispatch: Email sent successfully')
  }

  /**
   * Send an in-app notification.
   */
  static async sendInAppNotification(orgId: string, payload: NotificationPayload): Promise<void> {
    try {
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      if (!prefs.databaseId) {
        throw new Error(`Organisation ${orgId} does not have a provisioned database.`)
      }
      const databaseId = prefs.databaseId

      await appwrite.databases.createDocument({
        databaseId,
        collectionId: Collections.NOTIFICATIONS,
        documentId: ID.unique(),
        data: {
          userId: payload.userId,
          title: payload.title,
          body: payload.body,
          link: payload.link || null,
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        permissions: [
          Permission.read(Role.user(payload.userId)),
          Permission.update(Role.user(payload.userId)),
          Permission.delete(Role.user(payload.userId)),
        ],
      })
      logger.info({ orgId, payload }, 'In-App Notification created successfully')
    } catch (err: any) {
      logger.error({ err, orgId, payload }, 'Failed to send in-app notification')
    }
  }

  /**
   * Notify a user about a new courier assignment.
   */
  static async notifyCourierAssignment(
    orgId: string,
    courierId: string,
    assigneeEmail: string,
    assigneeId: string
  ): Promise<void> {
    const subject = `You have been assigned a new Courier`
    const body = `You have been assigned to courier ID: ${courierId}. Please review it in your dashboard.`

    // Send Email
    await this.sendEmail({
      to: assigneeEmail,
      subject,
      html: `<p>${body}</p>`,
      text: body,
    })

    // Send In-App Notification
    await this.sendInAppNotification(orgId, {
      userId: assigneeId,
      title: 'New Courier Assignment',
      body,
      link: `/couriers/${courierId}`,
    })
  }

  /**
   * Notify assignee (user or department members) about a new courier assignment.
   */
  static async notifyAssignment(
    orgId: string,
    courierId: string,
    targetType: 'user' | 'department',
    targetId: string
  ): Promise<void> {
    try {
      if (targetType === 'user') {
        const email = await this.getEmailByUserId(orgId, targetId)
        if (email) {
          await this.notifyCourierAssignment(orgId, courierId, email, targetId)
        }
      } else if (targetType === 'department') {
        const membersService = await MembersService.forOrg(orgId)
        const members = await membersService.listByDepartment(targetId)
        for (const member of members) {
          const email = await this.getEmailByUserId(orgId, member.userId)
          if (email) {
            await this.notifyCourierAssignment(orgId, courierId, email, member.userId)
          }
        }
      }
    } catch (err: any) {
      logger.error(
        { err, orgId, courierId, targetType, targetId },
        'Failed to send courier assignment notifications'
      )
    }
  }

  /**
   * Notify participants about a new chat message or reply.
   */
  static async notifyNewMessageOrReply(
    orgId: string,
    courierId: string,
    senderId: string,
    itemType: 'message' | 'reply'
  ): Promise<void> {
    try {
      // Fetch courier details to find creator and assignee
      const teamPrefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      if (!teamPrefs.databaseId) return

      const courierDoc = await appwrite.databases.getDocument({
        databaseId: teamPrefs.databaseId,
        collectionId: Collections.COURIERS,
        documentId: courierId,
      })

      const creatorId = courierDoc.createdBy
      const assigneeId = courierDoc.internalEntityId
      const targetType = courierDoc.targetType

      const recipients = new Set<string>()

      // If sender is NOT the creator, add creator to recipients
      if (creatorId && creatorId !== senderId) {
        recipients.add(creatorId)
      }

      // If sender is NOT the assignee
      if (assigneeId && assigneeId !== senderId) {
        if (targetType === 'user') {
          recipients.add(assigneeId)
        } else if (targetType === 'department') {
          const membersService = await MembersService.forOrg(orgId)
          const members = await membersService.listByDepartment(assigneeId)
          for (const member of members) {
            if (member.userId !== senderId) {
              recipients.add(member.userId)
            }
          }
        }
      }

      // Send to all unique recipients
      for (const recipientId of recipients) {
        const email = await this.getEmailByUserId(orgId, recipientId)
        if (email) {
          const subject = `New ${itemType} on Courier`
          const body = `A new ${itemType} was posted on courier ID: ${courierId}.`

          await this.sendEmail({
            to: email,
            subject,
            html: `<p>${body}</p>`,
            text: body,
          })

          await this.sendInAppNotification(orgId, {
            userId: recipientId,
            title: `New Courier ${itemType === 'message' ? 'Message' : 'Reply'}`,
            body,
            link: `/couriers/${courierId}`,
          })
        }
      }
    } catch (err: any) {
      logger.error(
        { err, orgId, courierId, senderId },
        'Failed to send new message/reply notifications'
      )
    }
  }

  /**
   * Notify users about a new courier message.
   */
  static async notifyNewMessage(
    orgId: string,
    courierId: string,
    recipientEmail: string,
    recipientId: string
  ): Promise<void> {
    const subject = `New message on Courier`
    const body = `A new message was posted on courier ID: ${courierId}.`

    // Send Email
    await this.sendEmail({
      to: recipientEmail,
      subject,
      html: `<p>${body}</p>`,
      text: body,
    })

    // Send In-App Notification
    await this.sendInAppNotification(orgId, {
      userId: recipientId,
      title: 'New Courier Message',
      body,
      link: `/couriers/${courierId}`,
    })
  }
}
