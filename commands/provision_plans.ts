import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { PlanProvisioner } from '#modules/plans/provision_plans_collections'

export default class ProvisionPlans extends BaseCommand {
  static commandName = 'provision:plans'
  static description = 'Provisions or updates global plans, subscriptions, and licenses collections'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Starting provisioning plans collections...')
    try {
      await PlanProvisioner.provision()
      this.logger.success('Provisioning complete!')
    } catch (error: any) {
      this.logger.error(`Provisioning failed: ${error.message}`)
      this.exitCode = 1
    }
  }
}
