import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OrganisationsController = () => import('#modules/organisations/organisations_controller')
const MembersController = () => import('#modules/organisations/members_controller')
const OrganisationModulesController = () => import('#modules/organisations/organisation_modules_controller')

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
      .params({ organisations: 'orgId', members: 'memberId' })

    // Module Management
    router.get('modules', [OrganisationModulesController, 'indexAvailable'])
    router.get('organisations/:orgId/modules', [OrganisationModulesController, 'indexActive'])
    router.post('organisations/:orgId/modules', [OrganisationModulesController, 'activate'])
    router.delete('organisations/:orgId/modules/:module', [OrganisationModulesController, 'deactivate'])
  })
  .prefix('/api/v1')
  .use(middleware.auth())
