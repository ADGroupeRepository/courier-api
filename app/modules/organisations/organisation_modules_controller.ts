import type { HttpContext } from '@adonisjs/core/http'
import ModuleProvisioningService from '#modules/_registry/provisioning_service'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'
import PlanService from '#modules/plans/plan_service'

export default class OrganisationModulesController {
  /**
   * GET /api/v1/modules
   * Get all modules available in the system.
   */
  async indexAvailable({ response }: HttpContext) {
    try {
      const result = await appwrite.databases.listDocuments({
        databaseId: 'bara-platform',
        collectionId: 'marketplace_modules',
        queries: [Query.equal('isActive', true)],
      })

      const modules = result.documents.map((doc) => ({
        name: doc.moduleName,
        label: doc.label,
        description: doc.description,
        core: doc.core,
      }))

      return response.ok({ data: modules })
    } catch (error: any) {
      return response.internalServerError({
        message: 'Error fetching available modules',
        error: error.message,
      })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/modules
   * List active modules for a specific organisation.
   */
  async indexActive({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any

    return response.ok({ data: prefs.modules || [] })
  }

  /**
   * POST /api/v1/organisations/:orgId/modules
   * Activate a module for an organisation.
   */
  async activate({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const { module, moduleName } = request.only(['module', 'moduleName'])
    const finalModule = module || moduleName

    if (!finalModule || typeof finalModule !== 'string') {
      return response.badRequest({
        message: 'Module name is required (use "module" or "moduleName" field)',
      })
    }

    // Check Plan Limit for Max Modules
    const usage = await PlanService.getOrgUsage(orgId)
    if (usage.modulesActive.max !== -1 && usage.modulesActive.used >= usage.modulesActive.max) {
      return response.forbidden({
        message: `Plan limit reached: You can only have ${usage.modulesActive.max} active modules on your current plan.`,
      })
    }

    const service = new ModuleProvisioningService()
    try {
      await service.activate(orgId, finalModule)
      return response.created({ message: `Module "${finalModule}" activated successfully` })
    } catch (error: any) {
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/modules/:module
   * Deactivate a module for an organisation.
   */
  async deactivate({ request, response }: HttpContext) {
    const orgId = request.param('orgId')
    const moduleName = request.param('module')

    const service = new ModuleProvisioningService()
    try {
      await service.deactivate(orgId, moduleName)
      return response.ok({ message: `Module "${moduleName}" deactivated successfully` })
    } catch (error: any) {
      return response.badRequest({ message: error.message })
    }
  }
}
