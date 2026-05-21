import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OrganisationsController = () => import('#modules/organisations/organisations_controller')
const MembersController = () => import('#modules/organisations/members_controller')
const OrganisationModulesController = () =>
  import('#modules/organisations/organisation_modules_controller')
const OrgLicensesController = () => import('#modules/organisations/org_licenses_controller')

router
  .group(() => {
    // ── Routes requiring a valid subscription ───────────────────────────
    router
      .group(() => {
        // Members nested under a specific organisation
        router
          .resource('organisations.members', MembersController)
          .apiOnly()
          .except(['store'])
          .params({ organisations: 'orgId', members: 'memberId' })

        router
          .post('organisations/:orgId/members', [MembersController, 'store'])
          .use(middleware.planGuard('limit:maxMembers'))

        // Seat Licenses
        router.get('organisations/:orgId/licenses', [OrgLicensesController, 'index'])
        router.post('organisations/:orgId/licenses/assign', [OrgLicensesController, 'assign'])
        router.post('organisations/:orgId/licenses/revoke', [OrgLicensesController, 'revoke'])

        // Module Management (Active modules listing and deactivation)
        router.get('organisations/:orgId/modules', [OrganisationModulesController, 'indexActive'])
        router
          .post('organisations/:orgId/modules', [OrganisationModulesController, 'activate'])
          .use(middleware.planGuard('limit:maxModules'))
        router.delete('organisations/:orgId/modules/:module', [
          OrganisationModulesController,
          'deactivate',
        ])

        // Organisation logo, update, and deactivation
        router.post('organisations/:id/logo', [OrganisationsController, 'uploadLogo'])
        router
          .route('organisations/:id', ['PUT', 'PATCH'], [OrganisationsController, 'update'])
          .as('organisations.update')
        router.delete('organisations/:id', [OrganisationsController, 'destroy'])
      })
      .use(middleware.planGuard('limit:subscription'))

    // ── Global / public / subscription-independent routes ────────────────
    // We only expose index, store, and show outside of subscription checks,
    // so users can list/create orgs and view their dashboard details
    // (which includes displaying banners if subscription is pending/expired).
    router
      .resource('organisations', OrganisationsController)
      .apiOnly()
      .only(['index', 'store', 'show'])

    // Module Management (Available modules list)
    router.get('modules', [OrganisationModulesController, 'indexAvailable'])
  })
  .prefix('/api/v1')
  .use(middleware.auth())
