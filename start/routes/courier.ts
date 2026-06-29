import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const CourierController = () => import('#modules/courier/courier_controller')
const CourierChatController = () => import('#modules/courier/courier_chat_controller')
const CourierRepliesController = () => import('#modules/courier/courier_replies_controller')

router
  .group(() => {
    // Courier CRUD
    router.get('couriers', [CourierController, 'index'])
    router.post('couriers', [CourierController, 'store'])
    router.post('couriers/upload-url', [CourierController, 'createUploadUrl'])
    router.get('couriers/:id', [CourierController, 'show'])
    router.patch('couriers/:id', [CourierController, 'update'])
    router.delete('couriers/:id', [CourierController, 'destroy'])
    router.delete('couriers/:id/force', [CourierController, 'forceDestroy'])
    router.post('couriers/:id/restore', [CourierController, 'restore'])
    router.post('couriers/:id/pickup', [CourierController, 'pickup'])
    router.post('couriers/:id/handover', [CourierController, 'handover'])
    router.post('couriers/:id/dispatch', [CourierController, 'dispatch'])
    router.post('couriers/:id/impute', [CourierController, 'impute'])
    router.get('couriers/:id/activities', [CourierController, 'activities'])

    // Courier Chat Messages
    router.post('couriers/:id/messages', [CourierChatController, 'store'])

    // Courier Replies
    router.get('couriers/:id/replies', [CourierRepliesController, 'index'])
    router.post('couriers/:id/replies', [CourierRepliesController, 'store'])
  })
  .prefix('/api/v1/organisations/:orgId')
  .use(middleware.auth())
  .use(middleware.verified())
  .use(middleware.orgAuth())
  .use(middleware.moduleGuard('courier'))
