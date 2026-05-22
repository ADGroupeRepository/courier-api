import appwrite from '#services/appwrite_service'
import { MODULE_REGISTRY } from './module_registry.js'
import logger from '@adonisjs/core/services/logger'

export default class ModuleProvisioningService {
  /**
   * Helper to delay execution (used to wait for Appwrite attributes to be 'available'
   * before creating indexes).
   */
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Activate a module for an organisation.
   * Creates collections, attributes, and indexes if they do not exist.
   */
  async activate(orgId: string, moduleName: string): Promise<void> {
    const moduleDef = MODULE_REGISTRY.get(moduleName)
    if (!moduleDef) {
      throw new Error(`Module "${moduleName}" not found in registry.`)
    }

    // 1. Get org preferences to find databaseId
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId) {
      throw new Error(`Organisation ${orgId} does not have a provisioned database.`)
    }
    const databaseId = prefs.databaseId

    logger.info({ orgId, moduleName }, '[ModuleProvisioning] Activating module...')

    // 2. Process each collection in the module
    for (const collDef of moduleDef.collections) {
      console.log(`[ModuleProvisioning] Processing collection: ${collDef.id}.`)
      try {
        // Try getting the table to see if it already exists
        await appwrite.databases.getCollection({
          databaseId,
          collectionId: collDef.id,
        })
        logger.info(
          { orgId, collectionId: collDef.id },
          '[ModuleProvisioning] Collection already exists, skipping creation.'
        )
        // Note: For a production-ready system, you might want to diff columns here
        // and create any missing ones, but we skip for simplicity if it already exists.
        continue
      } catch (error: any) {
        if (error.code !== 404) {
          throw error
        }
      }

      // 3. Create table
      logger.info(
        { orgId, collectionId: collDef.id },
        '[ModuleProvisioning] Creating collection...'
      )
      await appwrite.databases.createCollection({
        databaseId,
        collectionId: collDef.id,
        name: collDef.name,
        permissions: collDef.permissions(orgId),
        documentSecurity: collDef.documentSecurity,
      })

      // 4. Create columns
      for (const attr of collDef.attributes) {
        switch (attr.type) {
          case 'string':
            await appwrite.databases.createStringAttribute({
              databaseId,
              collectionId: collDef.id,
              key: attr.key,
              size: attr.size || 255,
              required: attr.required,
              array: attr.array,
            })
            break
          case 'integer':
            await appwrite.databases.createIntegerAttribute({
              databaseId,
              collectionId: collDef.id,
              key: attr.key,
              required: attr.required,
              array: attr.array,
            })
            break
          case 'boolean':
            await appwrite.databases.createBooleanAttribute({
              databaseId,
              collectionId: collDef.id,
              key: attr.key,
              required: attr.required,
              array: attr.array,
            })
            break
          case 'enum':
            await appwrite.databases.createEnumAttribute({
              databaseId,
              collectionId: collDef.id,
              key: attr.key,
              elements: attr.elements || [],
              required: attr.required,
              array: attr.array,
            })
            break
          case 'datetime':
            await appwrite.databases.createDatetimeAttribute({
              databaseId,
              collectionId: collDef.id,
              key: attr.key,
              required: attr.required,
              array: attr.array,
            })
            break
          case 'double':
            await appwrite.databases.createFloatAttribute({
              databaseId,
              collectionId: collDef.id,
              key: attr.key,
              required: attr.required,
              array: attr.array,
            })
            break
          case 'email':
            await appwrite.databases.createEmailAttribute({
              databaseId,
              collectionId: collDef.id,
              key: attr.key,
              required: attr.required,
              array: attr.array,
            })
            break
          // Add other types as needed
        }
      }

      // Appwrite processes columns asynchronously.
      // We must wait for them to become 'available' before creating indexes.
      // A safe delay is usually 2-3 seconds for a few columns.
      if (collDef.indexes.length > 0) {
        logger.info(
          { orgId, collectionId: collDef.id },
          '[ModuleProvisioning] Waiting for attributes to be ready before creating indexes...'
        )
        await this.sleep(3000)

        // 5. Create indexes
        for (const idx of collDef.indexes) {
          await appwrite.databases.createIndex({
            databaseId,
            collectionId: collDef.id,
            key: idx.key,
            type: idx.type as any,
            attributes: idx.attributes,
            orders: idx.orders?.map((o: string) => o.toLowerCase() as any),
          })
        }
      }
    }

    // 6. Update team preferences to record activation
    const activeModules: string[] = prefs.modules || []
    if (!activeModules.includes(moduleName)) {
      activeModules.push(moduleName)
      await appwrite.teams.updatePrefs({
        teamId: orgId,
        prefs: { ...prefs, modules: activeModules },
      })
    }

    logger.info({ orgId, moduleName }, '[ModuleProvisioning] Module activated successfully.')
  }

  /**
   * Deactivate a module for an organisation.
   * This simply removes it from the 'modules' list in team prefs.
   * It DOES NOT drop the collections (to prevent accidental data loss).
   */
  async deactivate(orgId: string, moduleName: string): Promise<void> {
    const moduleDef = MODULE_REGISTRY.get(moduleName)
    if (!moduleDef) {
      throw new Error(`Module "${moduleName}" not found in registry.`)
    }

    if (moduleDef.core) {
      throw new Error(`Cannot deactivate core module "${moduleName}".`)
    }

    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    const activeModules: string[] = prefs.modules || []

    if (activeModules.includes(moduleName)) {
      const updatedModules = activeModules.filter((m) => m !== moduleName)
      await appwrite.teams.updatePrefs({
        teamId: orgId,
        prefs: { ...prefs, modules: updatedModules },
      })
      logger.info({ orgId, moduleName }, '[ModuleProvisioning] Module deactivated.')
    }
  }
}
