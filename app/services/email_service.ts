import { Resend } from 'resend'
import logger from '@adonisjs/core/services/logger'
import mailConfig from '#config/mail'
import type { EmailPayload } from '#services/notification_service'

/**
 * EmailService wraps the Resend SDK for sending transactional emails.
 * All errors are caught and logged non-fatally so that a mail failure
 * does not crash the calling operation.
 */
export default class EmailService {
  private static readonly client = new Resend(mailConfig.resendApiKey)

  static async send(payload: EmailPayload): Promise<void> {
    try {
      const { data, error } = await this.client.emails.send({
        from: mailConfig.fromAddress,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      })

      if (error) {
        logger.error({ error, to: payload.to, subject: payload.subject }, 'Resend email failed')
        return
      }

      logger.info(
        { id: data?.id, to: payload.to, subject: payload.subject },
        'Email sent via Resend'
      )
    } catch (err: any) {
      logger.error(
        { err, to: payload.to, subject: payload.subject },
        'Unexpected error sending email via Resend'
      )
    }
  }
}
