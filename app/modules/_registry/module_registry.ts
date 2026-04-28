import { ModuleDefinition } from './types.js'
import { directoryModule } from './definitions/directory.js'
import { courierModule } from './definitions/courier.js'

export const MODULE_REGISTRY = new Map<string, ModuleDefinition>([
  [directoryModule.name, directoryModule],
  [courierModule.name, courierModule],
])
