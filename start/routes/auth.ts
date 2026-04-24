import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#modules/auth/auth_controller')

router
  .group(() => {
    // Public: rate-limited to 10 req / 60s per IP
    router
      .post('/signup', [AuthController, 'signup'])
      .use(middleware.rateLimit({ max: 10, windowMs: 60_000 }))

    router
      .post('/login', [AuthController, 'login'])
      .use(middleware.rateLimit({ max: 10, windowMs: 60_000 }))

    // Protected
    router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
    router.get('/me', [AuthController, 'me']).use(middleware.auth())
    router.post('/me/avatar', [AuthController, 'uploadAvatar']).use(middleware.auth())
    router.delete('/me/avatar', [AuthController, 'deleteAvatar']).use(middleware.auth())
  })
  .prefix('/api/v1/auth')
