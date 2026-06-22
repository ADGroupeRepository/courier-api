import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import appwrite from '#services/appwrite_service'
import ModuleProvisioningService from '#modules/_registry/provisioning_service'

export default class ProvisionExternalContacts extends BaseCommand {
  static readonly commandName = 'provision:external-contacts'
  static readonly description =
    'Creates the external_contacts collection for organisations that already have the courier module active'

  static readonly options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Fetching all organisations...')

    try {
      const result = await appwrite.teams.list()
      this.logger.info(`Found ${result.total} organisations. Checking courier module activation...`)

      const provisioningService = new ModuleProvisioningService()
      let provisionedCount = 0
      let skippedCount = 0
      let failedCount = 0

      for (const team of result.teams) {
        const prefs = (await appwrite.teams.getPrefs({ teamId: team.$id })) as any
        const activeModules: string[] = prefs.modules || []

        if (!activeModules.includes('courier')) {
          skippedCount += 1
          this.logger.info(`Skipping ${team.name} (${team.$id}) because courier is not active.`)
          continue
        }

        this.logger.info(`Provisioning courier collections for ${team.name} (${team.$id})...`)
        try {
          await provisioningService.activate(team.$id, 'courier')
          provisionedCount += 1
          this.logger.success(`Successfully provisioned courier collections for: ${team.name}`)
        } catch (orgError: any) {
          failedCount += 1
          this.logger.error(
            `Failed for organisation ${team.name} (${team.$id}): ${orgError.message}`
          )
        }
      }

      this.logger.success(
        `External contacts provisioning completed. Provisioned: ${provisionedCount}, skipped: ${skippedCount}, failed: ${failedCount}.`
      )

      if (failedCount > 0) {
        this.exitCode = 1
      }
    } catch (error: any) {
      this.logger.error(`Provisioning external contacts failed: ${error.message}`)
      this.exitCode = 1
    }
  }
}
