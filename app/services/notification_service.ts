import logger from '@adonisjs/core/services/logger'
import appwrite from '#services/appwrite_service'
import { Query, ID, Permission, Role } from 'node-appwrite'
import type { MessagingProviderType } from 'node-appwrite'
import MembersService from '#modules/directory/members_service'
import { Collections } from '#modules/_registry/collection_ids'
import EmailService from '#services/email_service'
import AuthService from '#modules/auth/auth_service'

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
  senderName?: string
  senderAvatarUrl?: string
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
          senderName: payload.senderName || null,
          senderAvatarUrl: payload.senderAvatarUrl || null,
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
    assigneeEmail: string | null | undefined,
    assigneeId: string,
    senderName?: string,
    senderAvatarUrl?: string
  ): Promise<void> {
    const subject = `Nouveau courrier assigné`
    const bodyText = `Vous avez été assigné au courrier ${courierId}. Veuillez le consulter dans votre tableau de bord.`

    // Envoi de l'email
    if (assigneeEmail) {
      try {
        await this.sendEmail({
          to: assigneeEmail,
          subject,
          html: buildEmailHtml(
            subject,
            `<p style="margin:0 0 16px">Un nouveau courrier vous a été assigné.</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr><td style="padding:8px 12px;background:#f4f4f5;border-radius:6px;font-family:monospace;font-size:14px">${courierId}</td></tr>
            </table>
            <p style="margin:0 0 24px">Connectez-vous à votre tableau de bord pour le consulter et le traiter.</p>`,
            'Voir le courrier'
          ),
          text: bodyText,
        })
      } catch (err) {
        logger.error({ err }, 'Failed to send email notification')
      }
    }

    // Notification in-app
    await this.sendInAppNotification(orgId, {
      userId: assigneeId,
      title: 'Nouveau courrier assigné',
      body: bodyText,
      link: `/couriers/${courierId}`,
      senderName,
      senderAvatarUrl,
    })

    // Notification push
    await this.sendPushNotification([assigneeId], subject, bodyText, {
      courierId,
      link: `/couriers/${courierId}`,
    })
  }

  /**
   * Notify a user about a new courier imputation/handler designation.
   */
  static async notifyCourierImputation(
    orgId: string,
    courierId: string,
    assigneeEmail: string | null | undefined,
    assigneeId: string,
    senderName?: string,
    senderAvatarUrl?: string
  ): Promise<void> {
    const subject = `Responsable assigné au courrier`
    const bodyText = `Vous avez été désigné comme responsable du traitement du courrier ${courierId}. Veuillez l'examiner dans votre tableau de bord.`

    // Send Email
    if (assigneeEmail) {
      try {
        await this.sendEmail({
          to: assigneeEmail,
          subject,
          html: buildEmailHtml(
            subject,
            `<p style="margin:0 0 16px">Vous avez été désigné comme responsable du traitement d'un courrier.</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr><td style="padding:8px 12px;background:#f4f4f5;border-radius:6px;font-family:monospace;font-size:14px">${courierId}</td></tr>
            </table>
            <p style="margin:0 0 24px">Connectez-vous à votre tableau de bord pour l'examiner et le traiter.</p>`,
            'Voir le courrier'
          ),
          text: bodyText,
        })
      } catch (err) {
        logger.error({ err }, 'Failed to send email notification')
      }
    }

    // Send In-App Notification
    await this.sendInAppNotification(orgId, {
      userId: assigneeId,
      title: 'Responsable assigné au courrier',
      body: bodyText,
      link: `/couriers/${courierId}`,
      senderName,
      senderAvatarUrl,
    })

    // Send Push Notification
    await this.sendPushNotification([assigneeId], subject, bodyText, {
      courierId,
      link: `/couriers/${courierId}`,
    })
  }

  /**
   * Notify a user that they have been designated as handler/imputer.
   */
  static async notifyImputation(
    orgId: string,
    courierId: string,
    handlerUserId: string
  ): Promise<void> {
    try {
      const email = await this.getEmailByUserId(orgId, handlerUserId)
      if (email) {
        const teamPrefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
        if (!teamPrefs.databaseId) return

        const courierDoc = await appwrite.databases.getDocument({
          databaseId: teamPrefs.databaseId,
          collectionId: Collections.COURIERS,
          documentId: courierId,
        })

        let senderName: string | undefined
        let senderAvatarUrl: string | undefined
        if (courierDoc.createdBy) {
          try {
            const senderUser = await appwrite.users.get({ userId: courierDoc.createdBy })
            senderName = senderUser.name || senderUser.email || 'Utilisateur'
            const avatarFileId = senderUser.prefs?.avatarFileId
            senderAvatarUrl = avatarFileId ? AuthService.buildPreviewUrl(avatarFileId) : undefined
          } catch (err) {
            logger.warn(
              { err, userId: courierDoc.createdBy },
              'Failed to fetch sender profile for notification'
            )
          }
        }

        await this.notifyCourierImputation(
          orgId,
          courierId,
          email,
          handlerUserId,
          senderName,
          senderAvatarUrl
        )
      }
    } catch (err: any) {
      logger.error(
        { err, orgId, courierId, handlerUserId },
        'Failed to send courier imputation notifications'
      )
    }
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
      const teamPrefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      if (!teamPrefs.databaseId) return

      const courierDoc = await appwrite.databases.getDocument({
        databaseId: teamPrefs.databaseId,
        collectionId: Collections.COURIERS,
        documentId: courierId,
      })

      let senderName: string | undefined
      let senderAvatarUrl: string | undefined
      if (courierDoc.createdBy) {
        try {
          const senderUser = await appwrite.users.get({ userId: courierDoc.createdBy })
          senderName = senderUser.name || senderUser.email || 'Utilisateur'
          const avatarFileId = senderUser.prefs?.avatarFileId
          senderAvatarUrl = avatarFileId ? AuthService.buildPreviewUrl(avatarFileId) : undefined
        } catch (err) {
          logger.warn(
            { err, userId: courierDoc.createdBy },
            'Failed to fetch sender profile for notification'
          )
        }
      }

      if (targetType === 'user') {
        const email = await this.getEmailByUserId(orgId, targetId)
        if (email) {
          await this.notifyCourierAssignment(
            orgId,
            courierId,
            email,
            targetId,
            senderName,
            senderAvatarUrl
          )
        }
      } else if (targetType === 'department') {
        const membersService = await MembersService.forOrg(orgId)
        const { documents: members } = await membersService.listByDepartment(targetId)
        for (const member of members) {
          const email = await this.getEmailByUserId(orgId, member.userId)
          if (email) {
            await this.notifyCourierAssignment(
              orgId,
              courierId,
              email,
              member.userId,
              senderName,
              senderAvatarUrl
            )
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

      let senderName: string | undefined
      let senderAvatarUrl: string | undefined
      try {
        const senderUser = await appwrite.users.get({ userId: senderId })
        senderName = senderUser.name || senderUser.email || 'Utilisateur'
        const avatarFileId = senderUser.prefs?.avatarFileId
        senderAvatarUrl = avatarFileId ? AuthService.buildPreviewUrl(avatarFileId) : undefined
      } catch (err) {
        logger.warn({ err, senderId }, 'Failed to fetch sender profile for notification')
      }

      // Send to all unique recipients
      for (const recipientId of recipients) {
        const email = await this.getEmailByUserId(orgId, recipientId)
        const label = itemType === 'message' ? 'Message' : 'Réponse'
        const subject = `Nouveau ${label.toLowerCase()} sur un courrier`
        const bodyText = `Un nouveau ${itemType === 'message' ? 'message' : 'réponse'} a été publié sur le courrier ${courierId}.`

        if (email) {
          try {
            await this.sendEmail({
              to: email,
              subject,
              html: buildEmailHtml(
                subject,
                `<p style="margin:0 0 16px">Un nouveau <strong>${itemType === 'message' ? 'message' : 'réponse'}</strong> a été publié sur un courrier auquel vous participez.</p>
                <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
                  <tr><td style="padding:8px 12px;background:#f4f4f5;border-radius:6px;font-family:monospace;font-size:14px">${courierId}</td></tr>
                </table>
                <p style="margin:0 0 24px">Connectez-vous à votre tableau de bord pour consulter et répondre.</p>`,
                `Voir le ${label.toLowerCase()}`
              ),
              text: bodyText,
            })
          } catch (err) {
            logger.error({ err }, 'Failed to send email notification')
          }
        }

        await this.sendInAppNotification(orgId, {
          userId: recipientId,
          title: `Nouveau ${label.toLowerCase()} sur un courrier`,
          body: bodyText,
          link: `/couriers/${courierId}`,
          senderName,
          senderAvatarUrl,
        })

        await this.sendPushNotification([recipientId], subject, bodyText, {
          courierId,
          link: `/couriers/${courierId}`,
        })
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
    const subject = `Nouveau message sur un courrier`
    const bodyText = `Un nouveau message a été publié sur le courrier ${courierId}.`

    // Envoi de l'email
    await this.sendEmail({
      to: recipientEmail,
      subject,
      html: buildEmailHtml(
        subject,
        `<p style="margin:0 0 16px">Un nouveau <strong>message</strong> a été publié sur un courrier auquel vous participez.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
          <tr><td style="padding:8px 12px;background:#f4f4f5;border-radius:6px;font-family:monospace;font-size:14px">${courierId}</td></tr>
        </table>
        <p style="margin:0 0 24px">Connectez-vous à votre tableau de bord pour consulter et répondre.</p>`,
        'Voir le message'
      ),
      text: bodyText,
    })

    // Notification in-app
    await this.sendInAppNotification(orgId, {
      userId: recipientId,
      title: 'Nouveau message sur un courrier',
      body: bodyText,
      link: `/couriers/${courierId}`,
    })

    await this.sendPushNotification([recipientId], subject, bodyText, {
      courierId,
      link: `/couriers/${courierId}`,
    })
  }

  /**
   * Registers a push token for a user.
   * Optimizes by checking if the token is already registered to prevent duplicates.
   */
  static async registerPushToken(
    userId: string,
    payload: {
      token: string
      providerType: 'push' | 'email' | 'sms'
      providerId?: string
      name?: string
    }
  ): Promise<void> {
    try {
      // Check if token already exists for the user to optimize and prevent duplicates
      const targets = await appwrite.users.listTargets({
        userId,
        queries: [Query.equal('identifier', payload.token)],
      })

      if (targets.total > 0) {
        logger.info({ userId, token: payload.token }, 'Push token already registered for this user')
        return
      }

      // Create the target
      await appwrite.users.createTarget({
        userId,
        targetId: ID.unique(),
        providerType: payload.providerType as MessagingProviderType,
        identifier: payload.token,
        providerId: payload.providerId || undefined,
        name: payload.name || 'Device Push Target',
      })
      logger.info(
        { userId, providerType: payload.providerType },
        'Push token registered successfully'
      )
    } catch (err: any) {
      logger.error({ err, userId, payload }, 'Failed to register push token in Appwrite')
      throw err
    }
  }

  /**
   * Send a push notification to specific users.
   */
  static async sendPushNotification(
    userIds: string[],
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<void> {
    try {
      const activeUserIds = userIds.filter((id) => id && id.trim() !== '')
      if (activeUserIds.length === 0) return

      await appwrite.messaging.createPush({
        messageId: ID.unique(),
        title,
        body,
        topics: [],
        users: activeUserIds,
        targets: [],
        data,
      })
      logger.info({ userIds: activeUserIds, title }, 'Push Notification sent successfully')
    } catch (err: any) {
      logger.error({ err, userIds, title }, 'Failed to send push notification')
    }
  }
}

/**
 * Builds a minimal but clean branded HTML email body.
 */
function buildEmailHtml(title: string, content: string, ctaLabel?: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
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
              <p style="margin:0;font-size:12px;color:#6b7280">Vous avez reçu cet email car vous êtes membre d'une organisation Bara. Pour toute question, contactez l'administrateur de votre organisation.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
