import type { HttpContext } from '@adonisjs/core/http'
import appwrite from '#services/appwrite_service'
import { MODULE_REGISTRY } from '#modules/_registry/module_registry'
import { Query, ID, Permission, Role } from 'node-appwrite'

export default class AdminMarketplaceController {
  private readonly databaseId = 'bara-platform'
  private readonly collectionId = 'marketplace_modules'

  /**
   * POST /api/v1/admin/marketplace
   * Publish a module to the marketplace so organisations can see and activate it.
   */
  async publish({ request, response }: HttpContext) {
    const { moduleName } = request.only(['moduleName'])

    if (!moduleName) {
      return response.badRequest({ message: 'moduleName is required' })
    }

    // 1. Check if it actually exists in our codebase registry
    const moduleDef = MODULE_REGISTRY.get(moduleName)
    if (!moduleDef) {
      return response.notFound({
        message: `Module "${moduleName}" is not defined in the codebase registry. Please build it first.`,
      })
    }

    try {
      // 2. Check if already published
      const existing = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        queries: [Query.equal('moduleName', moduleName)],
      })

      if (existing.documents.length > 0) {
        // Just set isActive to true if it was unpublished
        const doc = existing.documents[0]
        if (!doc.isActive) {
          await appwrite.databases.updateDocument({
            databaseId: this.databaseId,
            collectionId: this.collectionId,
            documentId: doc.$id,
            data: {
              isActive: true,
              label: moduleDef.label,
              description: moduleDef.description,
              core: moduleDef.core,
            },
          })
          return response.ok({ message: `Module "${moduleName}" republished successfully.` })
        }
        return response.ok({ message: `Module "${moduleName}" is already published.` })
      }

      // 3. Create new marketplace record
      await appwrite.databases.createDocument({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        documentId: ID.unique(),
        data: {
          moduleName: moduleDef.name,
          label: moduleDef.label,
          description: moduleDef.description,
          core: moduleDef.core,
          isActive: true,
        },
        permissions: [
          Permission.read(Role.any()), // Anyone can see it's published
          // Update/delete is restricted to admins (handled implicitly by Appwrite keys/rules or lack of permissions for Role.users())
        ],
      })

      return response.created({ message: `Module "${moduleName}" published successfully.` })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/admin/marketplace/:moduleName
   * Unpublish a module from the marketplace.
   */
  async unpublish({ request, response }: HttpContext) {
    const moduleName = request.param('moduleName')

    try {
      const existing = await appwrite.databases.listDocuments({
        databaseId: this.databaseId,
        collectionId: this.collectionId,
        queries: [Query.equal('moduleName', moduleName)],
      })

      if (existing.documents.length === 0) {
        return response.notFound({ message: `Module "${moduleName}" is not in the marketplace.` })
      }

      const doc = existing.documents[0]
      if (doc.isActive) {
        await appwrite.databases.updateDocument({
          databaseId: this.databaseId,
          collectionId: this.collectionId,
          documentId: doc.$id,
          data: {
            isActive: false,
          },
        })
      }

      return response.ok({ message: `Module "${moduleName}" unpublished successfully.` })
    } catch (error: any) {
      return response.internalServerError({ message: error.message })
    }
  }
}
