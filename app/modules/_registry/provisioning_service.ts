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
   * Helper to create a single attribute on a collection based on its type definition.
   */
  private async createAttribute(databaseId: string, collectionId: string, attr: any) {
    switch (attr.type) {
      case 'string':
        return appwrite.databases.createStringAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          size: attr.size || 255,
          required: attr.required,
          array: attr.array,
        })
      case 'integer':
        return appwrite.databases.createIntegerAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          required: attr.required,
          array: attr.array,
        })
      case 'boolean':
        return appwrite.databases.createBooleanAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          required: attr.required,
          array: attr.array,
        })
      case 'enum':
        return appwrite.databases.createEnumAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          elements: attr.elements || [],
          required: attr.required,
          array: attr.array,
        })
      case 'datetime':
        return appwrite.databases.createDatetimeAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          required: attr.required,
          array: attr.array,
        })
      case 'double':
        return appwrite.databases.createFloatAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          required: attr.required,
          array: attr.array,
        })
      case 'email':
        return appwrite.databases.createEmailAttribute({
          databaseId,
          collectionId,
          key: attr.key,
          required: attr.required,
          array: attr.array,
        })
    }
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

    // 2. Filter collections that need provisioning (skip existing ones)
    const collectionsToProvision: typeof moduleDef.collections = []

    for (const collDef of moduleDef.collections) {
      try {
        await appwrite.databases.getCollection({ databaseId, collectionId: collDef.id })
        logger.info(
          { orgId, collectionId: collDef.id },
          '[ModuleProvisioning] Collection already exists, skipping.'
        )
      } catch (error: any) {
        if (error.code !== 404) throw error
        collectionsToProvision.push(collDef)
      }
    }

    if (collectionsToProvision.length > 0) {
      // Phase A: Create all collections in parallel
      logger.info(
        { orgId, count: collectionsToProvision.length },
        '[ModuleProvisioning] Creating collections in parallel...'
      )
      await Promise.all(
        collectionsToProvision.map((collDef) =>
          appwrite.databases.createCollection({
            databaseId,
            collectionId: collDef.id,
            name: collDef.name,
            permissions: collDef.permissions(orgId),
            documentSecurity: collDef.documentSecurity,
          })
        )
      )

      // Phase B: Create all attributes in parallel
      logger.info({ orgId }, '[ModuleProvisioning] Creating attributes in parallel...')
      await Promise.all(
        collectionsToProvision.flatMap((collDef) =>
          collDef.attributes.map((attr) => this.createAttribute(databaseId, collDef.id, attr))
        )
      )

      // Phase C: Single wait for Appwrite to process all attributes
      const hasIndexes = collectionsToProvision.some((c) => c.indexes.length > 0)
      if (hasIndexes) {
        logger.info(
          { orgId },
          '[ModuleProvisioning] Waiting for attributes to be ready before creating indexes...'
        )
        await this.sleep(3000)

        // Phase D: Create all indexes in parallel
        logger.info({ orgId }, '[ModuleProvisioning] Creating indexes in parallel...')
        await Promise.all(
          collectionsToProvision.flatMap((collDef) =>
            collDef.indexes.map((idx) =>
              appwrite.databases.createIndex({
                databaseId,
                collectionId: collDef.id,
                key: idx.key,
                type: idx.type as any,
                attributes: idx.attributes,
                orders: idx.orders?.map((o: string) => o.toLowerCase() as any),
              })
            )
          )
        )
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
