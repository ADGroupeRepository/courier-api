import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DepartmentsController = () => import('#modules/directory/departments_controller')
const DepartmentMembersController = () => import('#modules/directory/department_members_controller')

router
  .group(() => {
    // Departments CRUD
    router.resource('departments', DepartmentsController).apiOnly()

    // Members management
    router.post('members/:membershipId/department', [DepartmentMembersController, 'assign'])
    router.get('departments/:id/members', [DepartmentMembersController, 'indexByDepartment'])
    router.delete('profiles/:id', [DepartmentMembersController, 'destroy'])
  })
  .prefix('/api/v1/organisations/:orgId')
  .use(middleware.auth())
  .use(middleware.moduleGuard('directory'))
