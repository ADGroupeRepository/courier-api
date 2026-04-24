import appwrite from '#services/appwrite_service'
import { Permission, Role, Compression } from 'node-appwrite'

async function bootstrapPublicMediaBucket() {
  const bucketId = 'public-media'
  try {
    await appwrite.storage.getBucket({ bucketId })
    console.log(`[Bootstrap] Bucket '${bucketId}' already exists.`)
  } catch (error: any) {
    // If the bucket does not exist, Appwrite throws a 404
    if (error.code === 404) {
      console.log(`[Bootstrap] Creating bucket '${bucketId}'...`)
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
      console.log(`[Bootstrap] Bucket '${bucketId}' created successfully.`)
    } else {
      console.error(`[Bootstrap] Error checking bucket '${bucketId}':`, error)
    }
  }
}

// Execute bootstrap
await bootstrapPublicMediaBucket()
