import type { ResourceContext } from '@jrmc/adonis-mcp/types/context'
import { Resource } from '@jrmc/adonis-mcp'

export default class GotchasResource extends Resource {
  name = 'gotchas'
  uri = 'adonisjs://gotchas'
  mimeType = 'text/plain'
  title = 'AdonisJS Gotchas & Silent Failures'
  description =
    'Critical mistakes that break AdonisJS apps silently. Read this before writing any code.'

  async handle({ response }: ResourceContext) {
    return response.text(
      `
# AdonisJS GOTCHAS — Read before writing any code

These are silent failures. No loud error. Just wrong behavior at runtime.

---

## GOTCHA 1 — import type kills dependency injection silently

SYMPTOM: Constructor dependency is undefined at runtime. No error thrown.

WHY: TypeScript strips "import type" at compile time. The IoC container
     receives nothing to construct — it can't inject what doesn't exist.

❌ WRONG (editor auto-import often does this):
  import type { UserService } from '#services/user_service'
  
  export default class UsersController {
    constructor(private userService: UserService) {}
    // userService is undefined at runtime
  }

✅ RIGHT:
  import UserService from '#services/user_service'
  
  @inject()
  export default class UsersController {
    constructor(private userService: UserService) {}
  }

RULE: Every class you want injected must be a VALUE import, never a type import.
      If your editor auto-imports as "import type", fix it immediately.

---

## GOTCHA 2 — .ts file extensions break production builds

SYMPTOM: Works in dev (ts-node handles it), crashes in production.

WHY: AdonisJS uses Node.js loader hooks for JIT TypeScript compilation.
     The Node runtime only understands .js. Loader hooks remap .js → .ts.
     Using .ts directly bypasses the remap and breaks in compiled output.

❌ WRONG:
  import UserService from './services/user_service.ts'

✅ RIGHT:
  import UserService from './services/user_service.js'
  // or with path alias:
  import UserService from '#services/user_service'

RULE: Always use .js extensions or path aliases (# prefix). Never .ts.

---

## GOTCHA 3 — HttpContext inside event listeners

SYMPTOM: "Cannot read property of undefined" or ctx is null inside listener.

WHY: Event listeners run asynchronously. By the time the listener executes,
     the HTTP request that triggered the event is already finished.
     HttpContext is request-scoped and no longer exists.

❌ WRONG:
  export default class SendWelcomeEmail {
    constructor(private ctx: HttpContext) {} // Will be undefined
    async handle(user: User) {
      const host = this.ctx.request.header('host') // CRASH
    }
  }

✅ RIGHT:
  @inject()
  export default class SendWelcomeEmail {
    constructor(private mailService: MailService) {}
    async handle(user: User) {
      await this.mailService.sendWelcome(user.email)
    }
  }

RULE: Listeners are constructed by the IoC container. Inject services, never HttpContext.

---

## GOTCHA 4 — Resolving container bindings inside register()

SYMPTOM: "Binding not found" or circular dependency errors on boot.

WHY: register() runs before any other provider has registered their bindings.
     You cannot use something that hasn't been registered yet.
     register() is for WRITING to the container, not READING from it.

❌ WRONG:
  register() {
    const config = this.app.container.make('config') // Too early — crashes
    this.app.container.singleton('myService', () => new MyService(config))
  }

✅ RIGHT:
  register() {
    this.app.container.singleton('myService', async (resolver) => {
      const config = await resolver.make('config') // Resolved lazily when needed
      return new MyService(config)
    })
  }

RULE: register() is synchronous and write-only. Read from container in boot() or later.

---

## GOTCHA 5 — Named middleware augmentation scope confusion

SYMPTOM: TypeScript says property exists, but it's undefined at runtime on some routes.

WHY: When you augment HttpContext for a named middleware property (e.g. ctx.tenant),
     TypeScript believes it exists everywhere. But if the middleware isn't applied
     to a route, the property simply won't exist at runtime.

❌ WRONG (augmenting as if it's always present):
  declare module '@adonisjs/core/http' {
    interface HttpContext {
      tenant: Tenant // Implies it always exists
    }
  }
  // Then accessing ctx.tenant on a public route without the middleware = undefined

✅ RIGHT:
  declare module '@adonisjs/core/http' {
    interface HttpContext {
      tenant?: Tenant // Mark as optional if not on every route
    }
  }
  // Or only use ctx.tenant inside routes where middleware is guaranteed

RULE: Only augment as non-optional when the middleware is in the global server stack.

---

## GOTCHA 6 — Forgetting @inject() decorator

SYMPTOM: Constructor args are undefined. No error.

WHY: Without @inject(), the IoC container doesn't know this class
     wants its dependencies auto-resolved. It just calls new MyClass()
     with no arguments.

❌ WRONG:
  export default class PostsController {
    constructor(private postService: PostService) {}
    // postService is undefined — @inject() is missing
  }

✅ RIGHT:
  import { inject } from '@adonisjs/core'
  
  @inject()
  export default class PostsController {
    constructor(private postService: PostService) {}
  }

NOTE: Controllers, middleware, and listeners registered through the framework
      are auto-constructed by the container, but they still need @inject()
      for their constructor dependencies to be resolved.

---

## GOTCHA 7 — Interfaces and types cannot be injected

SYMPTOM: Dependency resolves as undefined or container throws.

WHY: TypeScript interfaces and types don't exist at runtime.
     The container works with class constructors (runtime values).
     You cannot use an interface as a DI token.

❌ WRONG:
  interface IUserRepository { find(id: string): Promise<User> }
  
  @inject()
  class UserService {
    constructor(private repo: IUserRepository) {} // Container can't resolve this
  }

✅ RIGHT (use abstract class as a token):
  abstract class UserRepository { abstract find(id: string): Promise<User> }
  class LucidUserRepository extends UserRepository { ... }
  
  // In provider:
  container.bind(UserRepository, () => new LucidUserRepository())

---

## GOTCHA 8 — Preload files run AFTER boot, not during

SYMPTOM: Trying to access something in a preload file that isn't ready yet.

WHY: Preload files (start/routes.ts, start/events.ts etc.) run during
     the START phase. The BOOT phase (providers) runs first.
     This means preloads can safely use container-registered services,
     but providers should not depend on preload logic.

ORDER: register() → boot() → [preload files run] → start() → ready()

RULE: Routes, event listeners, and middleware registration belong in preload files.
      Service registration and extension belong in providers.
`.trim()
    )
  }
}
