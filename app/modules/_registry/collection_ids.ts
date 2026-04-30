/**
 * Centralized collection ID constants.
 *
 * Every service and controller should import from here instead of
 * hard-coding collection name strings. When a collection is renamed
 * in the registry definitions, update *only* this file.
 */
export const Collections = {
  // Directory module (core)
  DEPARTMENTS: 'departments',
  ORG_PROFILES: 'org_profiles',

  // Courier module
  COURIERS: 'couriers',

  // Courier module (external contacts address book)
  EXTERNAL_CONTACTS: 'external_contacts',
} as const

export type CollectionId = (typeof Collections)[keyof typeof Collections]
