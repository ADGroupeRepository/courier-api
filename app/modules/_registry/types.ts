export type AttributeType = 'string' | 'integer' | 'double' | 'boolean' | 'datetime' | 'email' | 'enum'

export interface AttributeDefinition {
  key: string
  type: AttributeType
  size?: number // Required for string
  required: boolean
  default?: any
  array?: boolean
  elements?: string[] // Required for enum
}

export interface IndexDefinition {
  key: string
  type: 'key' | 'unique' | 'fulltext'
  attributes: string[]
  orders?: ('ASC' | 'DESC')[]
}

export interface CollectionDefinition {
  id: string
  name: string
  documentSecurity?: boolean
  /**
   * Function that returns an array of permissions given an orgId.
   */
  permissions: (orgId: string) => string[]
  attributes: AttributeDefinition[]
  indexes: IndexDefinition[]
}

export interface ModuleDefinition {
  name: string
  label: string
  description: string
  /**
   * Core modules are auto-provisioned upon organisation creation and cannot be deactivated.
   */
  core: boolean
  collections: CollectionDefinition[]
}
