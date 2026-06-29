import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import appwrite from '#services/appwrite_service'

export default class ProvisionCourierInstruction extends BaseCommand {
  static readonly commandName = 'provision:courier-instruction'
  static readonly description =
    'Adds the instruction attribute to the couriers collection for organisations that already have the courier module active'

  static readonly options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Fetching all organisations...')

    try {
      const result = await appwrite.teams.list()
      this.logger.info(`Found ${result.total} organisations. Checking courier module activation...`)

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

        this.logger.info(
          `Provisioning courier instruction attribute for ${team.name} (${team.$id})...`
        )
        try {
          await appwrite.databases.createStringAttribute({
            databaseId: prefs.databaseId,
            collectionId: 'couriers',
            key: 'instruction',
            size: 2000,
            required: false,
          })
          provisionedCount += 1
          this.logger.success(`Successfully provisioned instruction attribute for: ${team.name}`)
        } catch (orgError: any) {
          if (
            orgError.message?.includes('already exists') ||
            orgError.message?.includes('exists')
          ) {
            skippedCount += 1
            this.logger.info(`Instruction attribute already exists for: ${team.name}`)
          } else {
            failedCount += 1
            this.logger.error(
              `Failed for organisation ${team.name} (${team.$id}): ${orgError.message}`
            )
          }
        }
      }

      this.logger.success(
        `Courier instruction provisioning completed. Provisioned: ${provisionedCount}, skipped: ${skippedCount}, failed: ${failedCount}.`
      )

      if (failedCount > 0) {
        this.exitCode = 1
      }
    } catch (error: any) {
      this.logger.error(`Provisioning courier instruction failed: ${error.message}`)
      this.exitCode = 1
    }
  }
}
