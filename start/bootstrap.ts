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

// Execute bootstrap
await bootstrapPublicMediaBucket()
