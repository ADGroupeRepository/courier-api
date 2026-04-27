import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DepartmentsController = () => import('#modules/directory/departments_controller')

router
  .group(() => {
    // Departments CRUD
    router.resource('departments', DepartmentsController).apiOnly()
  })
  .prefix('/api/v1/organisations/:orgId')
  .use(middleware.auth())
  .use(middleware.moduleGuard('directory'))
