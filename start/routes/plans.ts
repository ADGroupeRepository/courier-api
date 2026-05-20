import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PlansController = () => import('#modules/plans/plans_controller')

router
  .group(() => {
    // Public plan listing
    router.get('plans', [PlansController, 'index'])
    router.get('plans/:planId', [PlansController, 'show'])

    // Org-scoped subscription + usage (org owner sees full details, members see slim)
    router.get('organisations/:orgId/subscription', [PlansController, 'orgSubscription'])
    router.post('organisations/:orgId/subscription', [PlansController, 'subscribe'])
  })
  .prefix('/api/v1')
  .use(middleware.auth())
