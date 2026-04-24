import type { HttpContext } from '@adonisjs/core/http'
import AuthService from '#modules/auth/auth_service'
import { signupValidator, loginValidator } from '#modules/auth/auth_validator'

export default class AuthController {
  /**
   * POST /api/v1/auth/signup
   * Register a new user account.
   */
  async signup({ request, response }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)
    const authService = new AuthService()
    const user = await authService.signup(payload)
    return response.created({ message: 'Account created successfully', data: user })
  }

  /**
   * POST /api/v1/auth/login
   * Authenticate with email + password, receive a session token.
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const authService = new AuthService()
    const session = await authService.login(email, password)
    return response.ok({ message: 'Login successful', data: session })
  }

  /**
   * POST /api/v1/auth/logout
   * Invalidate the current session. Requires auth middleware.
   */
  async logout({ request, response }: HttpContext) {
    const authHeader = request.header('Authorization')!
    const token = authHeader.slice(7).trim()

    const sessionId = request.input('sessionId', 'current')
    const authService = new AuthService()
    await authService.logout(token, sessionId)

    return response.ok({ message: 'Logged out successfully' })
  }

  /**
   * GET /api/v1/auth/me
   * Return the authenticated user's profile.
   */
  async me({ user, response }: HttpContext) {
    // ctx.user is already populated by AuthMiddleware
    // We explicitly map only the fields the frontend needs to avoid leaking
    // internal Appwrite metadata (targets, prefs, internal IDs, etc.)
    const avatarFileId = user?.prefs?.avatarFileId
    const avatarUrl = avatarFileId ? AuthService.buildPreviewUrl(avatarFileId) : null

    return response.ok({
      data: {
        id: user?.$id,
        name: user?.name,
        email: user?.email,
        phone: user?.phone || null,
        avatarUrl,
        createdAt: user?.$createdAt,
        updatedAt: user?.$updatedAt,
      },
    })
  }

  /**
   * POST /api/v1/auth/me/avatar
   * Upload or replace the user's avatar.
   */
  async uploadAvatar({ request, response }: HttpContext) {
    const avatar = request.file('avatar', {
      size: '5mb',
      extnames: ['jpg', 'png', 'jpeg', 'webp'],
    })

    if (!avatar || !avatar.isValid) {
      return response.badRequest({ errors: avatar?.errors || 'Invalid file' })
    }

    const authHeader = request.header('Authorization')!
    const token = authHeader.slice(7).trim()

    const authService = new AuthService()
    const avatarUrl = await authService.uploadAvatar(token, avatar.tmpPath!, avatar.clientName)

    return response.ok({ message: 'Avatar uploaded successfully', data: { avatarUrl } })
  }

  /**
   * DELETE /api/v1/auth/me/avatar
   * Delete the user's avatar.
   */
  async deleteAvatar({ request, response }: HttpContext) {
    const authHeader = request.header('Authorization')!
    const token = authHeader.slice(7).trim()

    const authService = new AuthService()
    await authService.deleteAvatar(token)

    return response.ok({ message: 'Avatar deleted successfully' })
  }
}
