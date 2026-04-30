import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import appwrite from '#services/appwrite_service'
import { MODULE_REGISTRY } from '#modules/_registry/module_registry'

/**
 * Middleware to guard routes that belong to a specific module.
 * It checks if the organisation has activated the requested module.
 *
 * Usage:
 * router.get('...', [...]).use(middleware.moduleGuard('invoicing'))
 */
export default class ModuleGuardMiddleware {
  async handle(ctx: HttpContext, next: NextFn, moduleName: string) {
    // 1. Get orgId from route params
    const orgId = ctx.request.param('orgId')
    if (!orgId) {
      return ctx.response.badRequest({ message: 'Missing orgId in route parameters' })
    }

    // 2. Verify the module exists in the registry
    if (!MODULE_REGISTRY.has(moduleName)) {
      return ctx.response.internalServerError({
        message: `Module "${moduleName}" is not registered in the system`,
      })
    }

    // 3. Get the organisation preferences to check active modules
    try {
      // Use the sessionClient if it exists (so it respects user permissions to read team prefs),
      // or fallback to admin client if not explicitly required. We prefer admin client here
      // because not all users might have permission to read `prefs` directly,
      // but they should still be able to access the module if it's active for the org.
      const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
      const activeModules: string[] = prefs.modules || []

      if (!activeModules.includes(moduleName)) {
        return ctx.response.forbidden({
          message: `Module "${moduleName}" is not activated for this organisation. Please activate it first.`,
          module: moduleName,
        })
      }
    } catch (error: any) {
      if (error.code === 404) {
        return ctx.response.notFound({ message: 'Organisation not found' })
      }
      return ctx.response.internalServerError({
        message: 'Error verifying module access',
        error: error.message,
      })
    }

    // If we reach here, the module is active. Proceed to the controller.
    return next()
  }
}
