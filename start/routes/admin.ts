import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminMarketplaceController = () => import('#modules/admin/admin_marketplace_controller')

router
  .group(() => {
    // Marketplace management
    router.post('marketplace', [AdminMarketplaceController, 'publish'])
    router.delete('marketplace/:moduleName', [AdminMarketplaceController, 'unpublish'])
  })
  .prefix('/api/v1/admin')
  .use(middleware.auth())
  .use(middleware.admin()) // Protects these routes ensuring user has 'admin' label
