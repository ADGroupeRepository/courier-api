import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import appwrite from '#services/appwrite_service'
import { Collections } from '#modules/_registry/collection_ids'

export default class ProvisionCourierInterface extends BaseCommand {
  static readonly commandName = 'provision:courier-interface'
  static readonly description = 'Updates existing courier collections to use clear sender fields'

  static readonly options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Fetching all organisations...')

    try {
      const result = await appwrite.teams.list()
      this.logger.info(`Found ${result.total} organisations. Checking courier collections...`)

      let updatedCount = 0
      let skippedCount = 0
      let failedCount = 0

      for (const team of result.teams) {
        try {
          const prefs = (await appwrite.teams.getPrefs({ teamId: team.$id })) as any
          const activeModules: string[] = prefs.modules || []

          if (!prefs.databaseId || !activeModules.includes('courier')) {
            skippedCount += 1
            this.logger.info(`Skipping ${team.name} (${team.$id}) because courier is not active.`)
            continue
          }

          await appwrite.databases.getCollection({
            databaseId: prefs.databaseId,
            collectionId: Collections.COURIERS,
          })

          await this.renameOrCreateOptionalStringAttribute(
            prefs.databaseId,
            'contactName',
            'senderName'
          )
          await this.renameOrCreateOptionalStringAttribute(
            prefs.databaseId,
            'contactEmail',
            'senderEmail'
          )
          await this.renameOrCreateOptionalStringAttribute(
            prefs.databaseId,
            'contactPhone',
            'senderPhone'
          )
          await this.createOptionalDatetimeAttributeIfMissing(prefs.databaseId, 'receivedAt')

          await this.deleteAttributeIfExists(prefs.databaseId, 'createdAt')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactNumber')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactStructureType')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactStructureName')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactIdNumber')
          await this.deleteAttributeIfExists(prefs.databaseId, 'externalContactId')

          updatedCount += 1
          this.logger.success(`Updated courier interface for: ${team.name}`)
        } catch (orgError: any) {
          if (orgError.code === 404) {
            skippedCount += 1
            this.logger.info(`Skipping ${team.name} (${team.$id}) because couriers is missing.`)
            continue
          }

          failedCount += 1
          this.logger.error(
            `Failed for organisation ${team.name} (${team.$id}): ${orgError.message}`
          )
        }
      }

      this.logger.success(
        `Courier interface provisioning completed. Updated: ${updatedCount}, skipped: ${skippedCount}, failed: ${failedCount}.`
      )

      if (failedCount > 0) {
        this.exitCode = 1
      }
    } catch (error: any) {
      this.logger.error(`Provisioning courier interface failed: ${error.message}`)
      this.exitCode = 1
    }
  }

  private async renameOrCreateOptionalStringAttribute(
    databaseId: string,
    oldKey: string,
    newKey: string
  ) {
    try {
      await appwrite.databases.getAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key: newKey,
      })

      await appwrite.databases.updateStringAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key: newKey,
        required: false,
        size: 255,
      })
      return
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }
    }

    try {
      await appwrite.databases.updateStringAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key: oldKey,
        required: false,
        size: 255,
        newKey,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }

      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key: newKey,
        size: 255,
        required: false,
      })
    }
  }

  private async deleteAttributeIfExists(databaseId: string, key: string) {
    try {
      await appwrite.databases.deleteAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }
    }
  }

  private async createOptionalDatetimeAttributeIfMissing(databaseId: string, key: string) {
    try {
      await appwrite.databases.getAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }

      await appwrite.databases.createDatetimeAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key,
        required: false,
      })
    }
  }
}
