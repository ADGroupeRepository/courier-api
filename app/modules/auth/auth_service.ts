import { ID, AppwriteException, Query } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import { randomBytes } from 'node:crypto'
import appwrite from '#services/appwrite_service'
import appwriteConfig from '#config/appwrite'
import CacheService from '#services/cache_service'
import EmailService from '#services/email_service'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

interface SignupPayload {
  name: string
  email: string
  phone?: string
  password: string
}

/**
 * Handles all authentication operations: signup, login, logout, and
 * fetching the current user. Delegates all Appwrite SDK calls through
 * AppwriteService so controllers stay thin.
 */
export default class AuthService {
  /**
   * Register a new user account.
   *
   * Uses the admin Users API so we get the full user object back
   * without needing a session client.
   * @param payload - The signup details (name, email, password, phone).
   * @returns The created user profile.
   */
  async signup(payload: SignupPayload) {
    const { name, email, password, phone } = payload

    const user = await appwrite.users.create({
      userId: ID.unique(),
      email,
      password,
      name,
    })

    // Update phone separately if provided (Appwrite requires E.164 format)
    if (phone) {
      try {
        await appwrite.users.updatePhone({ userId: user.$id, number: phone })
      } catch (err) {
        // Non-fatal: log but don't fail the signup
        if (err instanceof AppwriteException) {
          logger.warn({ userId: user.$id, error: err.message }, 'Phone update failed during signup')
        }
      }
    }

    return {
      id: user.$id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      emailVerification: user.emailVerification,
      createdAt: user.$createdAt,
    }
  }

  /**
   * Return the currently authenticated user's profile.
   * @param jwt - The user's session JWT.
   * @returns The user's profile details.
   */
  async getUserProfile(jwt: string) {
    const { account } = appwrite.createSessionClient(jwt)
    const user = await account.get()

    return {
      id: user.$id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      createdAt: user.$createdAt,
      updatedAt: user.$updatedAt,
    }
  }

  /**
   * Build a public preview URL for any file stored in the public-media bucket.
   * @param fileId - The ID of the file.
   * @param width - The desired width of the preview.
   * @param height - The desired height of the preview.
   * @returns The public preview URL.
   */
  static buildPreviewUrl(fileId: string, width = 200, height = 200): string {
    return `${appwriteConfig.endpoint}/storage/buckets/public-media/files/${fileId}/preview?width=${width}&height=${height}&project=${appwriteConfig.projectId}`
  }

  /**
   * Upload a new avatar, replacing the existing one if any.
   * @param jwt - The user's session JWT.
   * @param tmpPath - The temporary path of the avatar file.
   * @param fileName - The original filename.
   * @returns The preview URL of the new avatar.
   */
  async uploadAvatar(jwt: string, tmpPath: string, fileName: string) {
    const { account } = appwrite.createSessionClient(jwt)
    const user = await account.get()
    const fileId = `avatar-${user.$id}`

    // 1. Delete old avatar if it exists
    const prefs = user.prefs as any
    if (prefs?.avatarFileId) {
      try {
        await appwrite.storage.deleteFile({
          bucketId: 'public-media',
          fileId: prefs.avatarFileId,
        })
      } catch (error: any) {
        // Ignore 404 if the file was already deleted
        if (error.code !== 404) throw error
      }
    }

    // 2. Upload the new avatar
    const file = InputFile.fromPath(tmpPath, fileName)
    await appwrite.storage.createFile({
      bucketId: 'public-media',
      fileId,
      file,
    })

    // 3. Update the user preferences
    await appwrite.users.updatePrefs({
      userId: user.$id,
      prefs: {
        ...user.prefs,
        avatarFileId: fileId,
      },
    })

    return AuthService.buildPreviewUrl(fileId)
  }

  /**
   * Delete the user's avatar entirely.
   * @param jwt - The user's session JWT.
   */
  async deleteAvatar(jwt: string) {
    const { account } = appwrite.createSessionClient(jwt)
    const user = await account.get()
    const prefs = user.prefs as any

    if (!prefs?.avatarFileId) {
      return
    }

    try {
      await appwrite.storage.deleteFile({
        bucketId: 'public-media',
        fileId: prefs.avatarFileId,
      })
    } catch (error: any) {
      if (error.code !== 404) throw error
    }

    const newPrefs = { ...user.prefs }
    delete newPrefs.avatarFileId

    await appwrite.users.updatePrefs({
      userId: user.$id,
      prefs: newPrefs,
    })
  }

  /**
   * Request email verification — generates a secure token, stores it in Redis,
   * and sends the verification email via Resend (bypassing Appwrite SMTP).
   * @param jwt - The user's session JWT.
   * @param redirectUrl - The base URL the front-end will redirect to with the token.
   */
  async requestEmailVerification(jwt: string, redirectUrl: string): Promise<{ userId: string }> {
    const { account } = appwrite.createSessionClient(jwt)
    const user = await account.get()

    if (user.emailVerification) {
      return { userId: user.$id }
    }

    // Generate a cryptographically secure token
    const secret = randomBytes(32).toString('hex')
    const cacheKey = `email_verify:${user.$id}`
    const verificationLink = `${redirectUrl}?userId=${user.$id}&secret=${secret}`

    // Store token in Redis with 24h TTL
    await CacheService.set(cacheKey, { secret, email: user.email }, 60 * 60 * 24)

    logger.info({ userId: user.$id, email: user.email }, 'Email verification token generated')

    // Send email via Resend
    await EmailService.send({
      to: user.email,
      subject: 'Vérifiez votre adresse e-mail',
      html: buildVerificationEmailHtml(user.name, verificationLink),
      text: `Bonjour ${user.name},\n\nVeuillez vérifier votre adresse e-mail en cliquant sur le lien ci-dessous :\n\n${verificationLink}\n\nCe lien expire dans 24 heures.`,
    })

    return { userId: user.$id }
  }

  /**
   * Confirm email verification using a custom Redis-backed token.
   * Marks the user as verified via the Appwrite Admin SDK.
   * @param userId - The user ID from the verification link.
   * @param secret - The verification secret from the verification link.
   */
  async confirmEmailVerification(userId: string, secret: string): Promise<{ verified: boolean }> {
    const cacheKey = `email_verify:${userId}`
    const cached = await CacheService.get<{ secret: string; email: string }>(cacheKey)

    if (!cached || cached.secret !== secret) {
      const error = new Error('Invalid or expired verification link.')
      ;(error as any).status = 400
      throw error
    }

    // Mark verified in Appwrite via Admin SDK
    await appwrite.users.updateEmailVerification({ userId, emailVerification: true })

    // Single-use: delete the token immediately
    await CacheService.delete(cacheKey)

    logger.info({ userId }, 'Email verified successfully')

    return { verified: true }
  }

  /**
   * Request a password reset — looks up the user, generates a secure Redis-backed
   * token, and sends a recovery email via Resend (bypassing Appwrite SMTP).
   * Silently succeeds if the email is not found (prevents email enumeration).
   * @param email - The email address to send recovery to.
   * @param redirectUrl - The base URL the front-end will use with the token.
   */
  async requestPasswordReset(email: string, redirectUrl: string): Promise<{ sent: boolean }> {
    try {
      // Find user by email via Admin SDK
      const usersResult = await appwrite.users.list({
        queries: [Query.equal('email', email)],
      })

      if (usersResult.total === 0) {
        // Silent success — prevent email enumeration
        logger.info({ email }, 'Password reset requested for unknown email — silently ignored')
        return { sent: false }
      }

      const user = usersResult.users[0]

      // Generate a cryptographically secure token
      const secret = randomBytes(32).toString('hex')
      const cacheKey = `pwd_reset:${secret}`
      const recoveryLink = `${redirectUrl}?userId=${user.$id}&secret=${secret}`

      // Store userId in Redis with 1h TTL
      await CacheService.set(cacheKey, { userId: user.$id }, 60 * 60)

      logger.info({ userId: user.$id, email }, 'Password reset token generated')

      // Send email via Resend
      await EmailService.send({
        to: user.email,
        subject: 'Réinitialisez votre mot de passe',
        html: buildPasswordResetEmailHtml(user.name, recoveryLink),
        text: `Bonjour ${user.name},\n\nRéinitialisez votre mot de passe en cliquant sur le lien ci-dessous :\n\n${recoveryLink}\n\nCe lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.`,
      })
    } catch (err: any) {
      // Log but do not expose internal errors to prevent information leakage
      logger.error({ err, email }, 'Error during password reset request')
    }

    return { sent: true }
  }

  /**
   * Confirm password reset using a custom Redis-backed token.
   * Updates the user's password via the Appwrite Admin SDK.
   * @param userId - The user ID from the recovery link.
   * @param secret - The recovery secret from the recovery link.
   * @param password - The new password.
   */
  async confirmPasswordReset(
    userId: string,
    secret: string,
    password: string
  ): Promise<{ reset: boolean }> {
    const cacheKey = `pwd_reset:${secret}`
    const cached = await CacheService.get<{ userId: string }>(cacheKey)

    if (!cached || cached.userId !== userId) {
      const error = new Error('Invalid or expired password reset link.')
      ;(error as any).status = 400
      throw error
    }

    // Update password via Admin SDK
    await appwrite.users.updatePassword({ userId, password })

    // Single-use: delete the token immediately
    await CacheService.delete(cacheKey)

    logger.info({ userId }, 'Password reset successfully')

    return { reset: true }
  }
}

// ── Email HTML Templates ──────────────────────────────────────────────────────

function buildVerificationEmailHtml(name: string, link: string): string {
  const appUrl = env.get('APP_URL')
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vérifiez votre adresse e-mail</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background:#111827;padding:24px 32px">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">Bara</span>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827">Vérifiez votre adresse e-mail</h1>
          <p style="margin:0 0 16px;color:#374151">Bonjour ${name},</p>
          <p style="margin:0 0 24px;color:#374151">Cliquez sur le bouton ci-dessous pour vérifier votre adresse e-mail. Ce lien expire dans <strong>24 heures</strong>.</p>
          <a href="${link}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">Vérifier l'e-mail &rarr;</a>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280">Ou copiez et collez ce lien dans votre navigateur :<br/><a href="${link}" style="color:#111827">${link}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#6b7280">Si vous n'avez pas créé de compte Bara, vous pouvez ignorer cet e-mail en toute sécurité. Visitez <a href="${appUrl}" style="color:#111827">${appUrl}</a> si vous avez des questions.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildPasswordResetEmailHtml(name: string, link: string): string {
  const appUrl = env.get('APP_URL')
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réinitialisez votre mot de passe</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background:#111827;padding:24px 32px">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">Bara</span>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827">Réinitialisez votre mot de passe</h1>
          <p style="margin:0 0 16px;color:#374151">Bonjour ${name},</p>
          <p style="margin:0 0 24px;color:#374151">Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour continuer. Ce lien expire dans <strong>1 heure</strong>.</p>
          <a href="${link}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">Réinitialiser le mot de passe &rarr;</a>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280">Ou copiez et collez ce lien dans votre navigateur :<br/><a href="${link}" style="color:#111827">${link}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#6b7280">Si vous n'avez pas demandé de réinitialisation de mot de passe, vous pouvez ignorer cet e-mail en toute sécurité. Votre mot de passe restera inchangé. Visitez <a href="${appUrl}" style="color:#111827">${appUrl}</a> si vous avez des questions.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
