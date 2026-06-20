import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import appwrite from '#services/appwrite_service'
import { Collections } from '#modules/_registry/collection_ids'

export default class DeleteStructureName extends BaseCommand {
  static commandName = 'delete:structure-name'
  static description = 'Removes the deprecated structureName attribute from external_contacts collections across all organization databases'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Fetching all organisations...')
    try {
      const result = await appwrite.teams.list()
      this.logger.info(`Found ${result.total} organisations. Processing attribute deletion...`)

      for (const team of result.teams) {
        const prefs = (await appwrite.teams.getPrefs({ teamId: team.$id })) as any
        const databaseId = prefs.databaseId

        if (!databaseId) {
          this.logger.info(`Organisation ${team.name} (${team.$id}) does not have a provisioned database. Skipping.`)
          continue
        }

        this.logger.info(`Checking database for organisation: ${team.name} (${team.$id})...`)
        try {
          // Delete attribute
          await appwrite.databases.deleteAttribute({
            databaseId,
            collectionId: Collections.EXTERNAL_CONTACTS,
            key: 'structureName',
          })
          this.logger.success(`Successfully queued/deleted 'structureName' attribute for: ${team.name}`)
        } catch (dbError: any) {
          if (dbError.code === 404) {
            this.logger.info(`Attribute 'structureName' already deleted or does not exist for: ${team.name}`)
          } else {
            this.logger.error(`Failed to delete attribute for ${team.name}: ${dbError.message}`)
          }
        }
      }

      this.logger.success('Deletion process completed!')
    } catch (error: any) {
      this.logger.error(`Failed to execute deletion: ${error.message}`)
      this.exitCode = 1
    }
  }
}