import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#modules/auth/auth_controller')

router
  .group(() => {
    // Public: rate-limited to 10 req / 60s per IP
    router
      .post('/signup', [AuthController, 'signup'])
      .use(middleware.rateLimit({ max: 10, windowMs: 60_000 }))

    // Public forgot password flows (rate-limited to 5 req / 60s)
    router
      .post('/forgot-password', [AuthController, 'requestPasswordReset'])
      .use(middleware.rateLimit({ max: 5, windowMs: 60_000 }))
    router
      .patch('/forgot-password', [AuthController, 'confirmPasswordReset'])
      .use(middleware.rateLimit({ max: 5, windowMs: 60_000 }))

    // Protected
    router.get('/profile', [AuthController, 'profile']).use(middleware.auth())
    router.post('/profile/avatar', [AuthController, 'uploadAvatar']).use(middleware.auth())
    router.delete('/profile/avatar', [AuthController, 'deleteAvatar']).use(middleware.auth())

    // Protected email verification flows
    router
      .post('/verify-email', [AuthController, 'requestEmailVerification'])
      .use(middleware.auth())
    router
      .patch('/verify-email', [AuthController, 'confirmEmailVerification'])
      .use(middleware.auth())
  })
  .prefix('/api/v1/auth')
