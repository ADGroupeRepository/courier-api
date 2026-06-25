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

          // 1. Ensure externalContactId and externalContactType exist on couriers
          try {
            await this.createOptionalStringAttributeIfMissing(prefs.databaseId, 'externalContactId')
          } catch (e: any) {
            this.logger.error(`Failed to create externalContactId: ${e.message}`)
            throw e
          }
          try {
            await this.createOptionalEnumAttributeIfMissing(
              prefs.databaseId,
              'externalContactType',
              ['personne', 'entreprise_privee', 'organisation_publique', 'ONG', 'autre']
            )
          } catch (e: any) {
            this.logger.error(`Failed to create externalContactType: ${e.message}`)
            throw e
          }

          // 2. Provision courier_assignments collection
          try {
            await this.ensureAssignmentsCollection(prefs.databaseId, team.$id)
          } catch (e: any) {
            this.logger.error(`Failed to create assignments collection: ${e.message}`)
            throw e
          }

          // 3. Clean up/rename old attributes if necessary
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
          await this.createOptionalDatetimeAttributeIfMissing(prefs.databaseId, 'emittedAt')
          await this.createOptionalStringArrayAttributeIfMissing(prefs.databaseId, 'fileIds')

          await this.deleteAttributeIfExists(prefs.databaseId, 'createdAt')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactNumber')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactStructureType')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactStructureName')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactIdNumber')

          updatedCount += 1
          this.logger.success(`Updated courier interface for: ${team.name}`)
        } catch (orgError: any) {
          if (orgError.code === 404) {
            skippedCount += 1
            this.logger.info(`Skipping ${team.name} (${team.$id}) because couriers is missing.`)
            continue
          }

          failedCount += 1
          this.logger.error(`Failed for organisation ${team.name} (${team.$id}): ${orgError.stack}`)
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
        xdefault: '',
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
        xdefault: '',
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

  private async createOptionalStringAttributeIfMissing(databaseId: string, key: string) {
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

      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key,
        size: 36,
        required: false,
        xdefault: '',
      })
    }
  }

  private async createOptionalStringArrayAttributeIfMissing(databaseId: string, key: string) {
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

      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key,
        size: 36,
        required: false,
        array: true,
      })
    }
  }

  private async createOptionalEnumAttributeIfMissing(
    databaseId: string,
    key: string,
    elements: string[]
  ) {
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

      await appwrite.databases.createEnumAttribute({
        databaseId,
        collectionId: Collections.COURIERS,
        key,
        elements,
        required: false,
        xdefault: elements[0],
      })
    }
  }

  private async ensureAssignmentsCollection(databaseId: string, orgId: string) {
    const { Permission, Role, IndexType } = await import('node-appwrite')

    try {
      await appwrite.databases.getCollection({
        databaseId,
        collectionId: Collections.COURIER_ASSIGNMENTS,
      })
      return
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }
    }

    await appwrite.databases.createCollection({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      name: 'Courier Assignments',
      permissions: [
        Permission.read(Role.team(orgId)),
        Permission.create(Role.team(orgId)),
        Permission.update(Role.team(orgId)),
        Permission.delete(Role.team(orgId, 'admin')),
      ],
      documentSecurity: true,
    })

    // Create attributes
    await appwrite.databases.createStringAttribute({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'courierId',
      size: 36,
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'entityId',
      size: 36,
      required: true,
    })

    await appwrite.databases.createEnumAttribute({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'entityType',
      elements: ['user', 'department', 'external_contact'],
      required: true,
    })

    await appwrite.databases.createStringAttribute({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'entityName',
      size: 255,
      required: false,
    })

    await appwrite.databases.createStringAttribute({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'assignedBy',
      size: 36,
      required: true,
    })

    // Delay before creating indexes to let attributes register
    await new Promise((resolve) => setTimeout(resolve, 3000))

    await appwrite.databases.createIndex({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'courier_idx',
      type: IndexType.Key,
      attributes: ['courierId'],
    })

    await appwrite.databases.createIndex({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'entity_idx',
      type: IndexType.Key,
      attributes: ['entityId'],
    })

    await appwrite.databases.createIndex({
      databaseId,
      collectionId: Collections.COURIER_ASSIGNMENTS,
      key: 'entity_type_idx',
      type: IndexType.Key,
      attributes: ['entityId', 'entityType'],
    })
  }
}
