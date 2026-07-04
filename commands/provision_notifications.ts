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

          const teamPrefs = (await appwrite.teams.getPrefs({ teamId: team.$id })) as any
          const databaseId = teamPrefs.databaseId
          if (databaseId) {
            try {
              await appwrite.databases.createStringAttribute({
                databaseId,
                collectionId: 'notifications',
                key: 'senderId',
                size: 36,
                required: false,
              })
              this.logger.success(
                `Added 'senderId' attribute to notifications in database: ${databaseId}`
              )
            } catch (attrError: any) {
              // 409 means attribute already exists
              if (attrError.code !== 409) {
                this.logger.warning(
                  `Failed to add senderId attribute to database ${databaseId}: ${attrError.message}`
                )
              }
            }
          }
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
