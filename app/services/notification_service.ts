import logger from '@adonisjs/core/services/logger'
import appwrite from '#services/appwrite_service'
import { Query, ID, Permission, Role } from 'node-appwrite'
import MembersService from '#modules/directory/members_service'
import { Collections } from '#modules/_registry/collection_ids'
import EmailService from '#services/email_service'

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
 * Uses Resend for transactional email delivery and Appwrite Databases
 * for in-app notification documents.
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
   * Send an email notification via Resend.
   */
  static async sendEmail(payload: EmailPayload): Promise<void> {
    await EmailService.send(payload)
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
    const subject = `New Courier Assignment`
    const bodyText = `You have been assigned to courier ${courierId}. Please review it in your dashboard.`

    // Send Email
    await this.sendEmail({
      to: assigneeEmail,
      subject,
      html: buildEmailHtml(
        subject,
        `<p style="margin:0 0 16px">You have been assigned a new courier.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
          <tr><td style="padding:8px 12px;background:#f4f4f5;border-radius:6px;font-family:monospace;font-size:14px">${courierId}</td></tr>
        </table>
        <p style="margin:0 0 24px">Log in to your dashboard to review and action it.</p>`,
        'View Courier'
      ),
      text: bodyText,
    })

    // Send In-App Notification
    await this.sendInAppNotification(orgId, {
      userId: assigneeId,
      title: 'New Courier Assignment',
      body: bodyText,
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
        const { documents: members } = await membersService.listByDepartment(targetId)
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
          const { documents: members } = await membersService.listByDepartment(assigneeId)
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
          const label = itemType === 'message' ? 'Message' : 'Reply'
          const subject = `New Courier ${label}`
          const bodyText = `A new ${itemType} was posted on courier ${courierId}.`

          await this.sendEmail({
            to: email,
            subject,
            html: buildEmailHtml(
              subject,
              `<p style="margin:0 0 16px">A new <strong>${itemType}</strong> has been posted on a courier you are involved in.</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
                <tr><td style="padding:8px 12px;background:#f4f4f5;border-radius:6px;font-family:monospace;font-size:14px">${courierId}</td></tr>
              </table>
              <p style="margin:0 0 24px">Log in to your dashboard to view and respond.</p>`,
              `View ${label}`
            ),
            text: bodyText,
          })

          await this.sendInAppNotification(orgId, {
            userId: recipientId,
            title: `New Courier ${label}`,
            body: bodyText,
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
    const subject = `New Courier Message`
    const bodyText = `A new message was posted on courier ${courierId}.`

    // Send Email
    await this.sendEmail({
      to: recipientEmail,
      subject,
      html: buildEmailHtml(
        subject,
        `<p style="margin:0 0 16px">A new <strong>message</strong> has been posted on a courier you are involved in.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
          <tr><td style="padding:8px 12px;background:#f4f4f5;border-radius:6px;font-family:monospace;font-size:14px">${courierId}</td></tr>
        </table>
        <p style="margin:0 0 24px">Log in to your dashboard to view and respond.</p>`,
        'View Message'
      ),
      text: bodyText,
    })

    // Send In-App Notification
    await this.sendInAppNotification(orgId, {
      userId: recipientId,
      title: 'New Courier Message',
      body: bodyText,
      link: `/couriers/${courierId}`,
    })
  }
}

/**
 * Builds a minimal but clean branded HTML email body.
 */
function buildEmailHtml(title: string, content: string, ctaLabel?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:24px 32px">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">Bara</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111827">${title}</h1>
              ${content}
              ${ctaLabel ? `<a href="#" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">${ctaLabel} &rarr;</a>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f3f4f6">
              <p style="margin:0;font-size:12px;color:#6b7280">You received this email because you are a member of a Bara organisation. If you have questions, contact your organisation administrator.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
