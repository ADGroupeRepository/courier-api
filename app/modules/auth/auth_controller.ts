import AuthService from '#modules/auth/auth_service'
import {
  confirmEmailVerificationValidator,
  confirmPasswordResetValidator,
  requestPasswordResetValidator,
  signupValidator,
  updateProfileValidator,
  registerPushTokenValidator,
} from '#modules/auth/auth_validator'
import MembersService from '#modules/directory/members_service'
import OrganisationService from '#modules/organisations/organisation_service'
import PlanService from '#modules/plans/plan_service'
import appwrite from '#services/appwrite_service'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { Query } from 'node-appwrite'

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
   * GET /api/v1/auth/profile
   * Return the authenticated user's profile and their organisations.
   */
  async profile({ user, token, response }: HttpContext) {
    // ctx.user is already populated by AuthMiddleware
    const avatarFileId = user?.prefs?.avatarFileId
    const avatarUrl = avatarFileId ? AuthService.buildPreviewUrl(avatarFileId) : null

    const authService = new AuthService()

    const profile = await authService.getUserProfile(token!)
    const orgService = new OrganisationService()
    const organisations = await orgService.list(token!)

    const enrichedOrganisations = await Promise.all(
      organisations.map(async (org) => {
        // Use allSettled so one failure (e.g. missing collection attribute) doesn't lose everything
        const [subInfoResult, userLicenseResult, membershipResult, departmentsResult] =
          await Promise.allSettled([
            PlanService.getOrgSubscriptionInfo(org.id),
            PlanService.getUserLicense(org.id, profile.id),
            appwrite.teams.listMemberships({
              teamId: org.id,
              queries: [Query.equal('userId', [profile.id])],
            }),
            MembersService.forOrg(org.id).then((service) =>
              service.listDepartmentsForUser(profile.id)
            ),
          ])

        // Extract results with safe fallbacks
        const subInfo =
          subInfoResult.status === 'fulfilled'
            ? subInfoResult.value
            : { status: 'none' as const, plan: null, subscription: null, daysRemaining: null }

        if (subInfoResult.status === 'rejected') {
          logger.warn(
            { orgId: org.id, error: subInfoResult.reason?.message },
            '[Profile] Failed to fetch subscription info'
          )
        }

        const userLicense =
          userLicenseResult.status === 'fulfilled' ? userLicenseResult.value : null

        if (userLicenseResult.status === 'rejected') {
          logger.warn(
            { orgId: org.id, error: userLicenseResult.reason?.message },
            '[Profile] Failed to fetch user license'
          )
        }

        let roles: string[] = []
        if (membershipResult.status === 'fulfilled' && membershipResult.value.total > 0) {
          roles = membershipResult.value.memberships[0].roles
        } else if (membershipResult.status === 'rejected') {
          logger.warn(
            { orgId: org.id, error: membershipResult.reason?.message },
            '[Profile] Failed to fetch membership roles'
          )
        }

        const departments = departmentsResult.status === 'fulfilled' ? departmentsResult.value : []

        if (departmentsResult.status === 'rejected') {
          logger.warn(
            { orgId: org.id, error: departmentsResult.reason?.message },
            '[Profile] Failed to fetch user departments'
          )
        }

        const subscriptionStatus = subInfo.status
        const hasActiveSubscription =
          subscriptionStatus === 'active' || subscriptionStatus === 'grace_period'
        const hasValidLicense = !!userLicense

        return {
          id: org.id,
          name: org.name,
          logoUrl: org.logoUrl,
          roles,
          departments,
          subscriptionStatus,
          hasActiveSubscription,
          hasValidLicense,
          planName: subInfo.plan?.name || null,
          planSlug: subInfo.plan?.slug || null,
          expiresAt: subInfo.subscription?.expiresAt || null,
          daysRemaining: subInfo.daysRemaining,
        }
      })
    )

    return response.ok({
      data: {
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          emailVerification: profile.emailVerification,
          phone: profile.phone,
          avatarUrl,
          signatureUrl: profile.signatureUrl,
        },
        organisations: enrichedOrganisations,
      },
    })
  }

  async updateProfile({ request, response, token }: HttpContext) {
    const payload = await request.validateUsing(updateProfileValidator)

    const avatar = request.file('avatar')
    const signature = request.file('signature')

    const authService = new AuthService()
    const updatedUser = await authService.updateProfile(
      token!,
      { name: payload.name, phone: payload.phone },
      {
        avatar:
          avatar && avatar.tmpPath && avatar.clientName
            ? { tmpPath: avatar.tmpPath, fileName: avatar.clientName }
            : undefined,
        signature:
          signature && signature.tmpPath && signature.clientName
            ? { tmpPath: signature.tmpPath, fileName: signature.clientName }
            : undefined,
      }
    )

    return response.ok({ message: 'Profile updated successfully', data: updatedUser })
  }

  /**
   * POST /api/v1/auth/verify-email
   * Send a 6-digit OTP to the user's email for verification.
   */
  async requestEmailVerification({ token, response }: HttpContext) {
    const authService = new AuthService()
    const result = await authService.requestEmailVerification(token!)
    return response.ok({ message: 'Verification code sent successfully', data: result })
  }

  /**
   * PATCH /api/v1/auth/verify-email
   * Confirm email verification.
   */
  async confirmEmailVerification({ request, response }: HttpContext) {
    const { userId, otp } = await request.validateUsing(confirmEmailVerificationValidator)
    const authService = new AuthService()
    const result = await authService.confirmEmailVerification(userId, otp)
    return response.ok({ message: 'Email verified successfully', data: result })
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Request password reset OTP for a matching user email.
   */
  async requestPasswordReset({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(requestPasswordResetValidator)
    const authService = new AuthService()
    const result = await authService.requestPasswordReset(email)

    if (!result.sent) {
      return response.notFound({
        message: 'No user account was found for this email address',
      })
    }

    return response.ok({
      message: 'Password recovery code sent successfully to your email address',
      data: result,
    })
  }

  /**
   * PATCH /api/v1/auth/forgot-password
   * Confirm password reset with OTP.
   */
  async confirmPasswordReset({ request, response }: HttpContext) {
    const { email, otp, password } = await request.validateUsing(confirmPasswordResetValidator)
    const authService = new AuthService()
    const result = await authService.confirmPasswordReset(email, otp, password)
    return response.ok({ message: 'Password reset successfully', data: result })
  }

  /**
   * POST /api/v1/auth/push-token
   * Register a new device/push token target for the authenticated user.
   */
  async registerPushToken({ request, user, response }: HttpContext) {
    const payload = await request.validateUsing(registerPushTokenValidator)
    const notificationServiceModule = await import('#services/notification_service')
    const notificationService = notificationServiceModule.default

    await notificationService.registerPushToken(user!.$id, {
      token: payload.token,
      providerType: payload.providerType || 'push',
      providerId: payload.providerId,
      name: payload.name,
    })

    return response.ok({ message: 'Push token registered successfully' })
  }
}
