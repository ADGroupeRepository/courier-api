import { ID, AppwriteException, type Models } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import appwrite from '#services/appwrite_service'
import appwriteConfig from '#config/appwrite'
import logger from '@adonisjs/core/services/logger'

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
   * Request email verification link for the logged in user.
   * @param jwt - The user's session JWT.
   * @param url - The redirect landing URL.
   * @returns The generated token.
   */
  async requestEmailVerification(jwt: string, url: string): Promise<Models.Token> {
    const { account } = appwrite.createSessionClient(jwt)
    const token = await account.createEmailVerification({ url })

    const verificationLink = `${url}?userId=${token.userId}&secret=${token.secret}`
    logger.info(
      {
        userId: token.userId,
        tokenId: token.$id,
        secret: token.secret,
        expire: token.expire,
        verificationLink,
      },
      'Email verification link generated (TODO: Integrate custom SMTP/Mail Provider in the future to customize/log full mail templates)'
    )

    return token
  }

  /**
   * Confirm email verification using the userId and secret.
   * @param jwt - The user's session JWT.
   * @param userId - The user ID to verify.
   * @param secret - The verification secret.
   * @returns The updated token status.
   */
  async confirmEmailVerification(
    jwt: string,
    userId: string,
    secret: string
  ): Promise<Models.Token> {
    const { account } = appwrite.createSessionClient(jwt)
    return await account.updateEmailVerification({ userId, secret })
  }

  /**
   * Request a password reset recovery link for the specified email.
   * @param email - The email to send recovery to.
   * @param url - The redirect landing URL.
   * @returns The generated recovery token.
   */
  async requestPasswordReset(email: string, url: string): Promise<Models.Token> {
    const token = await appwrite.account.createRecovery({ email, url })

    const recoveryLink = `${url}?userId=${token.userId}&secret=${token.secret}`
    logger.info(
      {
        userId: token.userId,
        tokenId: token.$id,
        secret: token.secret,
        expire: token.expire,
        recoveryLink,
      },
      'Password recovery link generated (TODO: Integrate custom SMTP/Mail Provider in the future to customize/log full mail templates)'
    )

    return token
  }

  /**
   * Confirm password reset using the userId, secret, and new password.
   * @param userId - The user ID.
   * @param secret - The recovery secret.
   * @param password - The new password.
   * @returns The updated recovery token status.
   */
  async confirmPasswordReset(
    userId: string,
    secret: string,
    password: string
  ): Promise<Models.Token> {
    return await appwrite.account.updateRecovery({ userId, secret, password })
  }
}
