import type { HttpContext } from '@adonisjs/core/http'
import DepartmentsService from '#modules/directory/departments_service'
import { createDepartmentValidator, updateDepartmentValidator } from '#modules/directory/departments_validator'

/**
 * Controller for the Directory module's Departments feature.
 * All routes are protected by AuthMiddleware + ModuleGuard('directory').
 */
export default class DepartmentsController {
  /**
   * GET /api/v1/organisations/:orgId/departments
   * List all departments for the organisation.
   */
  async index({ request, response }: HttpContext) {
    const orgId = request.param('orgId')

    try {
      const service = await DepartmentsService.forOrg(orgId)
      const departments = await service.list()
      return response.ok({ data: departments })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/departments/:id
   * Get a single department.
   */
  async show({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const departmentId = request.param('id')

    try {
      const service = await DepartmentsService.forOrg(orgId)
      const department = await service.get(departmentId)
      return response.ok({ data: department })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Department not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/departments
   * Create a new department.
   */
  async store({ request, response }: HttpContext) {
    const { organisationId, ...payload } = await request.validateUsing(createDepartmentValidator, {
      data: {
        ...request.all(),
        organisationId: request.param('orgId'),
      },
    })

    try {
      const service = await DepartmentsService.forOrg(organisationId)
      const department = await service.create(payload)
      return response.created({ data: department })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PUT /api/v1/organisations/:orgId/departments/:id
   * Update a department.
   */
  async update({ params, request, response }: HttpContext) {
    const { organisationId, ...payload } = await request.validateUsing(updateDepartmentValidator, {
      data: {
        ...request.all(),
        organisationId: request.param('orgId'),
      },
    })
    const departmentId = params.id

    try {
      const service = await DepartmentsService.forOrg(organisationId)
      const department = await service.update(departmentId, payload)
      return response.ok({ data: department })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Department not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/departments/:id
   * Delete a department.
   */
  async destroy({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const departmentId = request.param('id')

    try {
      const service = await DepartmentsService.forOrg(orgId)
      await service.delete(departmentId)
      return response.ok({ message: 'Department deleted successfully' })
    } catch (error: any) {
      if (error.code === 404) {
        return response.notFound({ message: 'Department not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }
}
