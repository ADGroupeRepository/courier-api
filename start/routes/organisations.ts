import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OrganisationsController = () => import('#modules/organisations/organisations_controller')
const MembersController = () => import('#modules/organisations/members_controller')
const OrganisationModulesController = () =>
  import('#modules/organisations/organisation_modules_controller')

router
  .group(() => {
    // Organisation CRUD — auto-generates index, store, show, update, destroy
    router.resource('organisations', OrganisationsController).apiOnly()

    // Organisation Logo
    router.post('organisations/:id/logo', [OrganisationsController, 'uploadLogo'])

    // Members nested under a specific organisation
    router
      .resource('organisations.members', MembersController)
      .apiOnly()
      .except(['store'])
      .params({ organisations: 'orgId', members: 'memberId' })

    router
      .post('organisations/:orgId/members', [MembersController, 'store'])
      .use(middleware.planGuard('limit:maxMembers'))

    // Module Management
    router.get('modules', [OrganisationModulesController, 'indexAvailable'])
    router.get('organisations/:orgId/modules', [OrganisationModulesController, 'indexActive'])
    router
      .post('organisations/:orgId/modules', [OrganisationModulesController, 'activate'])
      .use(middleware.planGuard('limit:maxModules'))
    router.delete('organisations/:orgId/modules/:module', [
      OrganisationModulesController,
      'deactivate',
    ])
  })
  .prefix('/api/v1')
  .use(middleware.auth())
