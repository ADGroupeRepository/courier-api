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

    const avatarFileId = user.prefs?.avatarFileId
    const avatarUrl = avatarFileId ? AuthService.buildPreviewUrl(avatarFileId) : null

    const signatureFileId = user.prefs?.signatureFileId
    const signatureUrl = signatureFileId ? AuthService.buildPreviewUrl(signatureFileId) : null

    return {
      id: user.$id,
      name: user.name,
      email: user.email,
      emailVerification: user.emailVerification,
      phone: user.phone || null,
      avatarUrl,
      signatureUrl,
      createdAt: user.$createdAt,
      updatedAt: user.$updatedAt,
    }
  }

  /**
   * Update the authenticated user's profile details, including optional avatar & signature.
   * @param jwt - The user's session JWT.
   * @param data - The fields to update (name, phone).
   * @param files - Optional avatar and signature files.
   * @returns The updated user profile.
   */
  async updateProfile(
    jwt: string,
    data: { name?: string; phone?: string },
    files?: {
      avatar?: { tmpPath: string; fileName: string }
      signature?: { tmpPath: string; fileName: string }
    }
  ) {
    const { account } = appwrite.createSessionClient(jwt)
    const user = await account.get()
    const updatedPrefs = { ...user.prefs }
    let prefsChanged = false

    // 1. Update text fields
    if (data.name !== undefined) {
      await appwrite.users.updateName({ userId: user.$id, name: data.name })
    }

    if (data.phone !== undefined) {
      try {
        await appwrite.users.updatePhone({ userId: user.$id, number: data.phone })
      } catch (err: any) {
        throw new Error(`Failed to update phone number: ${err.message}`)
      }
    }

    // 2. Handle optional avatar upload
    if (files?.avatar) {
      const fileId = `avatar-${user.$id}`
      if (updatedPrefs.avatarFileId) {
        try {
          await appwrite.storage.deleteFile({
            bucketId: 'public-media',
            fileId: updatedPrefs.avatarFileId,
          })
        } catch (error: any) {
          if (error.code !== 404) throw error
        }
      }

      const file = InputFile.fromPath(files.avatar.tmpPath, files.avatar.fileName)
      await appwrite.storage.createFile({
        bucketId: 'public-media',
        fileId,
        file,
      })

      updatedPrefs.avatarFileId = fileId
      prefsChanged = true
    }

    // 3. Handle optional signature upload
    if (files?.signature) {
      const fileId = `signature-${user.$id}`
      if (updatedPrefs.signatureFileId) {
        try {
          await appwrite.storage.deleteFile({
            bucketId: 'public-media',
            fileId: updatedPrefs.signatureFileId,
          })
        } catch (error: any) {
          if (error.code !== 404) throw error
        }
      }

      const file = InputFile.fromPath(files.signature.tmpPath, files.signature.fileName)
      await appwrite.storage.createFile({
        bucketId: 'public-media',
        fileId,
        file,
      })

      updatedPrefs.signatureFileId = fileId
      prefsChanged = true
    }

    // 4. Save changed preferences if any new files were uploaded
    if (prefsChanged) {
      await appwrite.users.updatePrefs({
        userId: user.$id,
        prefs: updatedPrefs,
      })
    }

    return this.getUserProfile(jwt)
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
   * Request email verification — generates a 6-digit OTP, stores it in Redis
   * for 30 minutes, and sends the code by email via Resend.
   * @param jwt - The user's session JWT.
   */
  async requestEmailVerification(jwt: string): Promise<{ userId: string }> {
    const { account } = appwrite.createSessionClient(jwt)
    const user = await account.get()

    if (user.emailVerification) {
      return { userId: user.$id }
    }

    // Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const cacheKey = `email_verify:${user.$id}`
    const OTP_TTL_SECONDS = 30 * 60 // 30 minutes

    // Store OTP in Redis with 30-minute TTL
    await CacheService.set(cacheKey, { otp, email: user.email }, OTP_TTL_SECONDS)

    logger.info({ userId: user.$id, email: user.email, otp }, 'Email verification OTP generated')

    // Send OTP email via Resend
    await EmailService.send({
      to: user.email,
      subject: 'Votre code de vérification e-mail',
      html: buildOtpEmailHtml(user.name, otp),
      text: `Bonjour ${user.name},\n\nVotre code de vérification est : ${otp}\n\nCe code expire dans 30 minutes. Ne le partagez avec personne.`,
    })

    return { userId: user.$id }
  }

  /**
   * Confirm email verification using the 6-digit OTP sent by email.
   * Marks the user as verified via the Appwrite Admin SDK.
   * @param userId - The user ID.
   * @param otp - The 6-digit OTP from the email.
   */
  async confirmEmailVerification(userId: string, otp: string): Promise<{ verified: boolean }> {
    const cacheKey = `email_verify:${userId}`
    const cached = await CacheService.get<{ otp: string; email: string }>(cacheKey)

    if (!cached || cached.otp !== otp) {
      const error = new Error('Invalid or expired verification code.')
      ;(error as any).status = 400
      throw error
    }

    // Mark verified in Appwrite via Admin SDK
    await appwrite.users.updateEmailVerification({ userId, emailVerification: true })

    // Single-use: delete the OTP immediately
    await CacheService.delete(cacheKey)

    logger.info({ userId }, 'Email verified successfully via OTP')

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

function buildOtpEmailHtml(name: string, otp: string): string {
  const appUrl = env.get('APP_URL')
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Votre code de vérification</title>
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
          <p style="margin:0 0 24px;color:#374151">Voici votre code de vérification à 6 chiffres. Ce code expire dans <strong>30 minutes</strong>.</p>
          <div style="display:inline-block;padding:16px 32px;background:#f3f4f6;color:#111827;border-radius:8px;font-size:24px;font-weight:700;letter-spacing:4px;margin-bottom:24px">
            ${otp}
          </div>
          <p style="margin:0;font-size:12px;color:#6b7280">Ne partagez jamais ce code avec quiconque.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#6b7280">Si vous n'avez pas demandé ce code, vous pouvez ignorer cet e-mail en toute sécurité. Visitez <a href="${appUrl}" style="color:#111827">${appUrl}</a> si vous avez des questions.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
