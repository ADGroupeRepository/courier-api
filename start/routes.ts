/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The main routes file acts as an entry point that imports all
| module-specific route files. Each module manages its own routes,
| prefixes, and middleware independently.
|
| To add a new module, create `start/routes/<module>.ts` and import it below.
|
*/

import router from '@adonisjs/core/services/router'

// Health check
router.get('/', async () => ({ status: 'ok', service: 'bara-api' }))

// ── Module Routes ───────────────────────────────────────────────────────────
import './routes/auth.js'
import './routes/organisations.js'
import './routes/admin.js'
import './routes/directory.js'
import './routes/courier.js'
import './routes/external_contacts.js'
