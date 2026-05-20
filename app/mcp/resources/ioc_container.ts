import type { ResourceContext } from '@jrmc/adonis-mcp/types/context'
import { Resource } from '@jrmc/adonis-mcp'

export default class IocContainerResource extends Resource {
  name = 'ioc_container'
  uri = 'adonisjs://concepts/ioc-container'
  mimeType = 'text/plain'
  title = 'IoC Container & Dependency Injection'
  description =
    'How the AdonisJS IoC container works, how to inject dependencies, register bindings, and test with swaps.'

  async handle({ response }: ResourceContext) {
    return response.text(
      `
# IoC Container & Dependency Injection

## MENTAL MODEL

The container is just "new ClassName()" done for you — with three extras:
  1. It resolves nested dependencies recursively
  2. It caches singletons so you get the same instance everywhere
  3. It lets you swap implementations for testing without touching production code

You don't need the container for everything. Plain imports work fine for
stateless utilities. Use the container when a class has dependencies that
need to be managed, shared, or swapped.

---

## THE @inject() DECORATOR — How auto-resolution works

@inject() reads TypeScript constructor parameter types at runtime via
reflect-metadata. It tells the container: "when constructing this class,
look at each constructor parameter's type and resolve it from the container."

@inject()
export default class OrderService {
  constructor(
    private userService: UserService,      // Resolved from container
    private mailer: MailService,            // Resolved from container
  ) {}
}

CRITICAL: The following classes are automatically constructed by the container
and support @inject() out of the box:
  - Controllers
  - Middleware
  - Event Listeners
  - Ace Commands
  - Exception Handlers

For any other class you create, you must either:
  a) Use container.make(MyClass) to construct it manually
  b) Register it as a binding in a service provider

---

## BINDINGS — Three types, three use cases

### 1. bind() — New instance every time
container.bind(TokenService, () => new TokenService())
// Every injection gets a fresh instance

### 2. singleton() — One instance shared everywhere
container.singleton(CacheService, () => new CacheService(config))
// Same instance across the entire application lifetime

### 3. value() — Register a pre-built instance
container.bindValue(HttpClient, axios.create({ baseURL: env.get('API_URL') }))
// Useful for wrapping third-party libs with configuration

---

## container.make() — Manual construction with DI

Use this when you need to construct a class outside of the normal
framework flow (e.g. inside a queue job runner, a custom command, etc.)

import app from '@adonisjs/core/services/app'

const orderService = await app.container.make(OrderService)
// All of OrderService's constructor dependencies are auto-resolved

---

## container.swap() — The testing superpower

Replaces a binding with a fake for the duration of a test.
Does NOT affect production code. Does NOT require mocking libraries.

test('sends welcome email on signup', async ({ client }) => {
  class FakeMailer {
    sent: any[] = []
    async send(message: any) { this.sent.push(message) }
  }

  const fakeMailer = new FakeMailer()
  
  app.container.swap(MailService, () => fakeMailer)
  
  await client.post('/signup').json({ email: 'test@example.com' })
  
  assert.lengthOf(fakeMailer.sent, 1)
  
  app.container.restore(MailService) // Always restore after test
})

// Better: use the test cleanup hook
test.group('Signup', (group) => {
  group.each.teardown(() => app.container.restoreAll())
})

---

## CONTAINER SERVICES — Pre-resolved framework modules

AdonisJS packages expose pre-configured singletons as ES module exports.
These are resolved from the container once during boot and exported.
Import them like any module — they just work.

import router from '@adonisjs/core/services/router'
import emitter from '@adonisjs/core/services/emitter'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'

WHY THIS PATTERN EXISTS: These modules require complex initialization that
depends on other container services. The package handles that once, you get
the clean import.

---

## RESOLVING HOOKS — Extending bindings after registration

Use resolving hooks in providers to extend a binding every time it's resolved.
Classic use case: adding custom VineJS rules.

// In a service provider's boot() method:
this.app.container.resolving('vinejs.validator', (validator) => {
  validator.rule('isSlug', slugValidationFn)
})

---

## WHAT NOT TO PUT IN THE CONTAINER

Not everything needs to be a container binding. Keep it simple:

✅ Register in container:
  - Services with complex dependencies
  - Services that need to be shared as singletons
  - Third-party integrations that need configuration
  - Anything you'll need to swap in tests

❌ Don't register in container:
  - Stateless utility functions (just export and import them)
  - Value objects / DTOs
  - Simple helper classes with no dependencies
  - Config objects (use the config service directly)
`.trim()
    )
  }
}
