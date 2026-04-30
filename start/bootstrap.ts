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
          Permission.read(Role.any()), // Anyone can view (public images)
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
    await appwrite.databases.get({ databaseId })
    logger.info({ databaseId }, '[Bootstrap] Platform database already exists')
  } catch (error: any) {
    if (error.code === 404) {
      logger.info({ databaseId }, '[Bootstrap] Creating platform database...')
      await appwrite.databases.create({
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
    await appwrite.databases.getCollection({ databaseId, collectionId })
    logger.info({ collectionId }, '[Bootstrap] Marketplace table already exists')
  } catch (error: any) {
    if (error.code === 404) {
      logger.info({ collectionId }, '[Bootstrap] Creating marketplace table...')
      await appwrite.databases.createCollection({
        databaseId,
        collectionId,
        name: 'Marketplace Modules',
        permissions: [
          Permission.read(Role.any()), // Anyone can read published modules
        ],
        documentSecurity: false,
      })

      // Columns
      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId,
        key: 'moduleName',
        size: 255,
        required: true,
      })
      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId,
        key: 'label',
        size: 255,
        required: true,
      })
      await appwrite.databases.createStringAttribute({
        databaseId,
        collectionId,
        key: 'description',
        size: 500,
        required: false,
      })
      await appwrite.databases.createBooleanAttribute({
        databaseId,
        collectionId,
        key: 'core',
        required: true,
      })
      await appwrite.databases.createBooleanAttribute({
        databaseId,
        collectionId,
        key: 'isActive',
        required: true,
      })

      logger.info('[Bootstrap] Waiting for columns to become available...')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Indexes
      await appwrite.databases.createIndex({
        databaseId,
        collectionId,
        key: 'module_name_idx',
        type: 'unique' as any,
        attributes: ['moduleName'],
      })
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
