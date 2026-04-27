import { ModuleDefinition } from './types.js'
import { directoryModule } from './definitions/directory.js'

export const MODULE_REGISTRY = new Map<string, ModuleDefinition>([
  [directoryModule.name, directoryModule],
])
