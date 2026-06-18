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
    router.get('couriers/:id', [CourierController, 'show'])
    router.patch('couriers/:id', [CourierController, 'update'])
    router.delete('couriers/:id', [CourierController, 'destroy'])
    router.delete('couriers/:id/force', [CourierController, 'forceDestroy'])
    router.post('couriers/:id/restore', [CourierController, 'restore'])

    // Courier Chat Messages
    router.get('couriers/:id/messages', [CourierChatController, 'index'])
    router.post('couriers/:id/messages', [CourierChatController, 'store'])

    // Courier Replies
    router.get('couriers/:id/replies', [CourierRepliesController, 'index'])
    router.post('couriers/:id/replies', [CourierRepliesController, 'store'])
    router.patch('couriers/:id/replies/:replyId', [CourierRepliesController, 'update'])
  })
  .prefix('/api/v1/organisations/:orgId')
  .use(middleware.auth())
  .use(middleware.verified())
  .use(middleware.moduleGuard('courier'))
