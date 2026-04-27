import appwrite from '#services/appwrite_service'
import logger from '@adonisjs/core/services/logger'
import { Permission, Role, Compression } from 'node-appwrite'

async function bootstrapPublicMediaBucket() {
  const bucketId = 'public-media'
  try {
    await appwrite.storage.getBucket({ bucketId })
    logger.info({ bucketId }, '[Bootstrap] Bucket already exists')
  } catch (error: any) {
    // If the bucket does not exist, Appwrite throws a 404
    if (error.code === 404) {
      logger.info({ bucketId }, '[Bootstrap] Creating bucket...')
      await appwrite.storage.createBucket({
        bucketId,
        name: 'Public Media',
        permissions: [
          Permission.read(Role.any()),    // Anyone can view (public images)
          Permission.create(Role.users()), // Authenticated users can upload
          Permission.update(Role.users()), // Authenticated users can replace
          Permission.delete(Role.users()), // Authenticated users can delete
        ],
        fileSecurity: true,
        maximumFileSize: 5 * 1024 * 1024, // 5 MB
        allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        compression: Compression.Gzip,
        encryption: false,
        antivirus: true,
        transformations: true, // Enables getFilePreview
      })
      logger.info({ bucketId }, '[Bootstrap] Bucket created successfully')
    } else {
      logger.error({ bucketId, error }, '[Bootstrap] Error checking bucket')
    }
  }
}

async function bootstrapPlatformDatabase() {
  const databaseId = 'bara-platform'
  const collectionId = 'marketplace_modules'

  try {
    await appwrite.tablesDB.get({ databaseId })
    logger.info({ databaseId }, '[Bootstrap] Platform database already exists')
  } catch (error: any) {
    if (error.code === 404) {
      logger.info({ databaseId }, '[Bootstrap] Creating platform database...')
      await appwrite.tablesDB.create({
        databaseId,
        name: 'Bara Platform Core',
      })
      logger.info({ databaseId }, '[Bootstrap] Platform database created successfully')
    } else {
      logger.error({ databaseId, error }, '[Bootstrap] Error checking platform database')
      return
    }
  }

  try {
    await appwrite.tablesDB.getTable({ databaseId, tableId: collectionId })
    logger.info({ collectionId }, '[Bootstrap] Marketplace table already exists')
  } catch (error: any) {
    if (error.code === 404) {
      logger.info({ collectionId }, '[Bootstrap] Creating marketplace table...')
      await appwrite.tablesDB.createTable({
        databaseId,
        tableId: collectionId,
        name: 'Marketplace Modules',
        permissions: [
          Permission.read(Role.any()), // Anyone can read published modules
        ],
        rowSecurity: false,
      })

      // Columns
      await appwrite.tablesDB.createTextColumn({ databaseId, tableId: collectionId, key: 'moduleName', required: true })
      await appwrite.tablesDB.createTextColumn({ databaseId, tableId: collectionId, key: 'label', required: true })
      await appwrite.tablesDB.createTextColumn({ databaseId, tableId: collectionId, key: 'description', required: false })
      await appwrite.tablesDB.createBooleanColumn({ databaseId, tableId: collectionId, key: 'core', required: true })
      await appwrite.tablesDB.createBooleanColumn({ databaseId, tableId: collectionId, key: 'isActive', required: true })

      logger.info('[Bootstrap] Waiting for columns to become available...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Indexes
      await appwrite.tablesDB.createIndex({ databaseId, tableId: collectionId, key: 'module_name_idx', type: 'unique' as any, columns: ['moduleName'] })
      logger.info({ collectionId }, '[Bootstrap] Marketplace table created successfully')
    } else {
      logger.error({ collectionId, error }, '[Bootstrap] Error checking marketplace table')
    }
  }
}

// Execute bootstrap
if (process.env.NODE_ENV !== 'test') {
  await bootstrapPublicMediaBucket()
  await bootstrapPlatformDatabase()
}
