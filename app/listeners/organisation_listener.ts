import type OrganisationCreated from '#events/organisation_created'
import ModuleProvisioningService from '#modules/_registry/provisioning_service'
import { MODULE_REGISTRY } from '#modules/_registry/module_registry'
import logger from '@adonisjs/core/services/logger'

export default class OrganisationListener {
  /**
   * Automatically provision core modules in the background when an organisation is created.
   */
  async onOrganisationCreated(event: OrganisationCreated) {
    const orgId = event.orgId
    logger.info({ orgId }, '[OrganisationListener] Beginning background core module activation...')

    try {
      const provisioningService = new ModuleProvisioningService()
      for (const [moduleName, moduleDef] of MODULE_REGISTRY) {
        if (moduleDef.core) {
          logger.info(
            { orgId, moduleName },
            `[OrganisationListener] Activating core module: ${moduleName}`
          )
          await provisioningService.activate(orgId, moduleName)
        }
      }
      logger.info(
        { orgId },
        '[OrganisationListener] Core modules activated successfully in the background.'
      )
    } catch (err: any) {
      logger.error(
        { err, orgId },
        '[OrganisationListener] Failed to activate core modules in background'
      )
    }
  }
}
