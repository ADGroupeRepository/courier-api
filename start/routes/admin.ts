import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminMarketplaceController = () => import('#modules/admin/admin_marketplace_controller')
const AdminPlansController = () => import('#modules/admin/admin_plans_controller')

router
  .group(() => {
    // Marketplace management
    router.post('marketplace', [AdminMarketplaceController, 'publish'])
    router.delete('marketplace/:moduleName', [AdminMarketplaceController, 'unpublish'])

    // Plan management
    router.get('plans', [AdminPlansController, 'indexPlans'])
    router.post('plans', [AdminPlansController, 'storePlan'])
    router.patch('plans/:planId', [AdminPlansController, 'updatePlan'])
    router.delete('plans/:planId', [AdminPlansController, 'destroyPlan'])
    router.get('plans/:planId/usage', [AdminPlansController, 'planUsage'])

    // License management
    router.get('licenses', [AdminPlansController, 'indexLicenses'])
    router.post('licenses', [AdminPlansController, 'issueLicense'])
    router.patch('licenses/:licenseId', [AdminPlansController, 'updateLicense'])
  })
  .prefix('/api/v1/admin')
  .use(middleware.auth())
  .use(middleware.admin()) // Protects these routes ensuring user has 'admin' label
