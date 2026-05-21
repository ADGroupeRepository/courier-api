import type { HttpContext } from '@adonisjs/core/http'
import { Query } from 'node-appwrite'
import logger from '@adonisjs/core/services/logger'
import AuthService from '#modules/auth/auth_service'
import { signupValidator } from '#modules/auth/auth_validator'
import OrganisationService from '#modules/organisations/organisation_service'
import PlanService from '#modules/plans/plan_service'
import appwrite from '#services/appwrite_service'

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
        const [subInfoResult, userLicenseResult, membershipResult] = await Promise.allSettled([
          PlanService.getOrgSubscriptionInfo(org.id),
          PlanService.getUserLicense(org.id, profile.id),
          appwrite.teams.listMemberships({
            teamId: org.id,
            queries: [Query.equal('userId', [profile.id])],
          }),
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

        const subscriptionStatus = subInfo.status
        const hasActiveSubscription =
          subscriptionStatus === 'active' || subscriptionStatus === 'grace_period'
        const hasValidLicense = !!userLicense

        return {
          id: org.id,
          name: org.name,
          logoUrl: org.logoUrl,
          roles,
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
          phone: profile.phone,
          avatarUrl,
        },
        organisations: enrichedOrganisations,
      },
    })
  }

  /**
   * POST /api/v1/auth/profile/avatar
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
   * DELETE /api/v1/auth/profile/avatar
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
