import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import appwrite from '#services/appwrite_service'
import { Collections } from '#modules/_registry/collection_ids'
import { CourierCustodyState } from '#modules/courier/courier_enums'

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

          // 1. Ensure correspondentId exists on couriers
          try {
            await this.renameOrCreateOptionalStringAttribute(
              prefs.databaseId,
              'externalContactId',
              'correspondentId',
              36
            )
          } catch (e: any) {
            this.logger.error(`Failed to create correspondentId: ${e.message}`)
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
          // Rename senderName to delivererName (or contactName if very old)
          try {
            await this.renameOrCreateOptionalStringAttribute(
              prefs.databaseId,
              'senderName',
              'delivererName'
            )
          } catch {
            await this.renameOrCreateOptionalStringAttribute(
              prefs.databaseId,
              'contactName',
              'delivererName'
            )
          }

          // Rename senderEmail to delivererEmail (or contactEmail if very old)
          try {
            await this.renameOrCreateOptionalStringAttribute(
              prefs.databaseId,
              'senderEmail',
              'delivererEmail'
            )
          } catch {
            await this.renameOrCreateOptionalStringAttribute(
              prefs.databaseId,
              'contactEmail',
              'delivererEmail'
            )
          }

          // Rename senderPhone to delivererPhone (or contactPhone if very old)
          try {
            await this.renameOrCreateOptionalStringAttribute(
              prefs.databaseId,
              'senderPhone',
              'delivererPhone'
            )
          } catch {
            await this.renameOrCreateOptionalStringAttribute(
              prefs.databaseId,
              'contactPhone',
              'delivererPhone'
            )
          }

          await this.createOptionalDatetimeAttributeIfMissing(prefs.databaseId, 'receivedAt')
          await this.createOptionalDatetimeAttributeIfMissing(prefs.databaseId, 'emittedAt')
          await this.createOptionalStringArrayAttributeIfMissing(prefs.databaseId, 'fileIds')

          // Physical custody tracking attributes
          await this.createOptionalEnumAttributeIfMissing(
            prefs.databaseId,
            'currentCustody',
            Object.values(CourierCustodyState),
            CourierCustodyState.COURIER_SERVICE
          )
          await this.createOptionalStringAttributeIfMissing(prefs.databaseId, 'custodyUserId', 36)
          await this.createOptionalStringAttributeIfMissing(prefs.databaseId, 'custodyDeptId', 36)
          await this.createOptionalStringAttributeIfMissing(
            prefs.databaseId,
            'signedProofFileId',
            36
          )
          await this.createOptionalDatetimeAttributeIfMissing(prefs.databaseId, 'dispatchedAt')
          await this.createOptionalStringAttributeIfMissing(prefs.databaseId, 'dispatchedBy', 36)
          await this.createOptionalStringAttributeIfMissing(prefs.databaseId, 'receivedBy', 36)
          await this.createOptionalStringAttributeIfMissing(prefs.databaseId, 'handlerUserId', 36)

          // Provision courier replies attributes
          await this.createOptionalStringAttributeIfMissing(
            prefs.databaseId,
            'subject',
            255,
            Collections.COURIER_REPLIES
          )
          await this.createOptionalStringAttributeIfMissing(
            prefs.databaseId,
            'notes',
            2000,
            Collections.COURIER_REPLIES
          )
          await this.createOptionalDatetimeAttributeIfMissing(
            prefs.databaseId,
            'emittedAt',
            Collections.COURIER_REPLIES
          )
          await this.createOptionalStringArrayAttributeIfMissing(
            prefs.databaseId,
            'fileIds',
            Collections.COURIER_REPLIES
          )
          await this.createOptionalStringAttributeIfMissing(
            prefs.databaseId,
            'delivererName',
            255,
            Collections.COURIER_REPLIES
          )
          await this.createOptionalStringAttributeIfMissing(
            prefs.databaseId,
            'delivererEmail',
            255,
            Collections.COURIER_REPLIES
          )
          await this.createOptionalStringAttributeIfMissing(
            prefs.databaseId,
            'delivererPhone',
            255,
            Collections.COURIER_REPLIES
          )
          await this.createOptionalStringAttributeIfMissing(
            prefs.databaseId,
            'note',
            2000,
            Collections.COURIER_REPLIES
          )

          // 4. Update Courier Indexes
          await this.deleteIndexIfExists(
            prefs.databaseId,
            Collections.COURIERS,
            'external_contact_idx'
          )
          await this.ensureIndex(
            prefs.databaseId,
            Collections.COURIERS,
            'correspondent_idx',
            'key',
            ['correspondentId']
          )
          await this.ensureIndex(prefs.databaseId, Collections.COURIERS, 'custody_idx', 'key', [
            'currentCustody',
          ])

          // 5. Delete unused legacy attributes
          await this.deleteAttributeIfExists(prefs.databaseId, 'externalContactType')
          await this.deleteAttributeIfExists(prefs.databaseId, 'createdAt')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactNumber')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactStructureType')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactStructureName')
          await this.deleteAttributeIfExists(prefs.databaseId, 'contactIdNumber')
          await this.deleteAttributeIfExists(
            prefs.databaseId,
            'documentStatus',
            Collections.COURIER_REPLIES
          )

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
    newKey: string,
    size: number = 255
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
        size,
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
        size,
        required: false,
        xdefault: '',
      })
    }
  }

  private async ensureIndex(
    databaseId: string,
    collectionId: string,
    key: string,
    type: string,
    attributes: string[]
  ) {
    try {
      await appwrite.databases.getIndex({
        databaseId,
        collectionId,
        key,
      })
      return
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }
    }

    try {
      await appwrite.databases.createIndex({
        databaseId,
        collectionId,
        key,
        type: type as any,
        attributes,
      })
    } catch (error: any) {
      this.logger.error(`Failed to create index ${key}: ${error.message}`)
    }
  }

  private async deleteIndexIfExists(databaseId: string, collectionId: string, key: string) {
    try {
      await appwrite.databases.deleteIndex({
        databaseId,
        collectionId,
        key,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }
    }
  }

  private async deleteAttributeIfExists(
    databaseId: string,
    key: string,
    collectionId: string = Collections.COURIERS
  ) {
    try {
      await appwrite.databases.deleteAttribute({
        databaseId,
        collectionId,
        key,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }
    }
  }

  private async createOptionalDatetimeAttributeIfMissing(
    databaseId: string,
    key: string,
    collectionId: string = Collections.COURIERS
  ) {
    try {
      await appwrite.databases.getAttribute({
        databaseId,
        collectionId,
        key,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }

      await appwrite.databases.createDatetimeAttribute({
        databaseId,
        collectionId,
        key,
        required: false,
      })
    }
  }

  private async createOptionalStringArrayAttributeIfMissing(
    databaseId: string,
    key: string,
    collectionId: string = Collections.COURIERS
  ) {
    try {
      await appwrite.databases.getAttribute({
        databaseId,
        collectionId,
        key,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }

      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId,
        key,
        size: 36,
        required: false,
        array: true,
      })
    }
  }

  private async createOptionalStringAttributeIfMissing(
    databaseId: string,
    key: string,
    size: number = 36,
    collectionId: string = Collections.COURIERS
  ) {
    try {
      await appwrite.databases.getAttribute({
        databaseId,
        collectionId,
        key,
      })
    } catch (error: any) {
      if (error.code !== 404) {
        throw error
      }

      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId,
        key,
        size,
        required: false,
      })
    }
  }

  private async createOptionalEnumAttributeIfMissing(
    databaseId: string,
    key: string,
    elements: string[],
    defaultValue: string
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
        xdefault: defaultValue,
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
