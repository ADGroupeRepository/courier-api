import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import appwrite from '#services/appwrite_service'
import ModuleProvisioningService from '#modules/_registry/provisioning_service'

export default class ProvisionNotifications extends BaseCommand {
  static readonly commandName = 'provision:notifications'
  static readonly description =
    'Activates/updates the directory module (including the new notifications collection) for all existing organisations'

  static readonly options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Fetching all organisations...')
    try {
      const result = await appwrite.teams.list()
      this.logger.info(`Found ${result.total} organisations. Starting activation...`)

      const provisioningService = new ModuleProvisioningService()

      for (const team of result.teams) {
        this.logger.info(
          `Activating 'directory' module for organisation: ${team.name} (${team.$id})...`
        )
        try {
          await provisioningService.activate(team.$id, 'directory')
          this.logger.success(`Successfully activated/updated directory module for: ${team.name}`)
        } catch (orgError: any) {
          this.logger.error(
            `Failed for organisation ${team.name} (${team.$id}): ${orgError.message}`
          )
        }
      }

      this.logger.success('Provisioning notifications completed!')
    } catch (error: any) {
      this.logger.error(`Provisioning notifications failed: ${error.message}`)
      this.exitCode = 1
    }
  }
}
