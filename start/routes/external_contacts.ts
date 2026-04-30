import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ExternalContactsController = () => import('#modules/external_contacts/external_contacts_controller')

router
  .group(() => {
    router.get('/', [ExternalContactsController, 'index'])
    router.get('/:id', [ExternalContactsController, 'show'])
    router.post('/', [ExternalContactsController, 'store'])
    router.patch('/:id', [ExternalContactsController, 'update'])
    router.delete('/:id', [ExternalContactsController, 'destroy'])
  })
  .prefix('/api/v1/organisations/:orgId/contacts')
  .use(middleware.auth())
  .use(middleware.moduleGuard('courier'))
