import { ID, Account, Client, AppwriteException } from 'node-appwrite'
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
   * Create an unauthenticated Appwrite Account service.
   *
   * `createEmailPasswordSession` is a public endpoint — no API key or
   * session token required, just the project ID.
   */
  private publicAccountService() {
    const client = new Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId)
      .setSelfSigned(true)
    return new Account(client)
  }

  /**
   * Register a new user account.
   *
   * Uses the admin Users API so we get the full user object back
   * without needing a session client.
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
   * Authenticate a user with email + password and return a JWT.
   *
   * 1. Verify credentials via the public Account API (createEmailPasswordSession).
   * 2. Generate a JWT via the admin Users API (users.createJWT).
   *
   * The returned `token` (JWT) must be sent by the client as
   * `Authorization: Bearer <token>` on all subsequent protected requests.
   */
  async login(email: string, password: string) {
    // Step 1 — Verify credentials (public client, no API key needed)
    const account = this.publicAccountService()
    const session = await account.createEmailPasswordSession({ email, password })

    // Step 2 — Generate a JWT via admin Users API
    const { jwt } = await appwrite.users.createJWT({
      userId: session.userId,
      sessionId: session.$id,
      duration: 3600, // 1 hour (maximum allowed by Appwrite)
    })

    return {
      token: jwt,
      expiresAt: session.expire,
    }
  }

  /**
   * Invalidate the current session (logout).
   */
  async logout(jwt: string, sessionId: string) {
    const { account } = appwrite.createSessionClient(jwt)
    await account.deleteSession({ sessionId })
  }

  /**
   * Return the currently authenticated user's profile.
   */
  async me(jwt: string) {
    const { account } = appwrite.createSessionClient(jwt)
    const user = await account.get()

    return {
      id: user.$id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      emailVerification: user.emailVerification,
      phoneVerification: user.phoneVerification,
      labels: user.labels,
      prefs: user.prefs,
      createdAt: user.$createdAt,
      updatedAt: user.$updatedAt,
    }
  }

  /**
   * Build a public preview URL for any file stored in the public-media bucket.
   */
  static buildPreviewUrl(fileId: string, width = 200, height = 200): string {
    return `${appwriteConfig.endpoint}/storage/buckets/public-media/files/${fileId}/preview?width=${width}&height=${height}&project=${appwriteConfig.projectId}`
  }

  /**
   * Upload a new avatar, replacing the existing one if any.
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
}
