import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const CourierController = () => import('#modules/courier/courier_controller')

router
  .group(() => {
    // Courier CRUD
    router.get('couriers', [CourierController, 'index'])
    router.post('couriers', [CourierController, 'store'])
    router.get('couriers/:id', [CourierController, 'show'])
    router.patch('couriers/:id', [CourierController, 'update'])
    router.delete('couriers/:id', [CourierController, 'destroy'])
  })
  .prefix('/api/v1/organisations/:orgId')
  .use(middleware.auth())
  .use(middleware.moduleGuard('courier'))
