import { Permission, Role } from 'node-appwrite'
import { type ModuleDefinition } from '../types.js'
import {
  CourierUrgency,
  CourierStatus,
  CourierType,
  CourierStructureType,
} from '#modules/courier/courier_enums'
import { Collections } from '#modules/_registry/collection_ids'

export const courierModule: ModuleDefinition = {
  name: 'courier',
  label: 'Courier Management',
  description:
    'Manage incoming and outgoing couriers, assignments, file attachments, and external contacts.',
  core: false,
  collections: [
    {
      id: Collections.COURIERS,
      name: 'Couriers',
      documentSecurity: true,
      permissions: (orgId: string) => [
        Permission.read(Role.team(orgId)),
        Permission.create(Role.team(orgId)),
        Permission.update(Role.team(orgId)),
        Permission.delete(Role.team(orgId, 'admin')),
      ],
      attributes: [
        { key: 'createdAt', type: 'datetime', required: true, default: new Date() },
        {
          key: 'type',
          type: 'enum',
          elements: Object.values(CourierType),
          required: true,
          default: CourierType.INCOMING,
        },
        {
          key: 'urgency',
          type: 'enum',
          elements: Object.values(CourierUrgency),
          required: true,
          default: CourierUrgency.NORMAL,
        },
        { key: 'subject', type: 'string', size: 255, required: true },
        { key: 'contactName', type: 'string', size: 255, required: true },
        { key: 'contactNumber', type: 'string', size: 255, required: true },
        {
          key: 'contactStructureType',
          type: 'enum',
          elements: Object.values(CourierStructureType),
          required: false,
        },
        { key: 'contactStructureName', type: 'string', size: 255, required: false },
        { key: 'contactIdNumber', type: 'string', size: 255, required: false },
        { key: 'contactPhone', type: 'string', size: 255, required: false },
        { key: 'contactEmail', type: 'string', size: 255, required: false },
        { key: 'externalContactId', type: 'string', size: 36, required: false }, // Link to external contact directory
        { key: 'internalEntityId', type: 'string', size: 36, required: true }, // ID of User or Department (Sender for Outgoing, Recipient for Incoming)
        {
          key: 'targetType',
          type: 'enum',
          elements: ['user', 'department'],
          required: true,
          default: 'user',
        },
        { key: 'fileId', type: 'string', size: 36, required: false },
        { key: 'createdBy', type: 'string', size: 36, required: true },
        {
          key: 'status',
          type: 'enum',
          elements: Object.values(CourierStatus),
          required: true,
          default: CourierStatus.PENDING,
        },
        { key: 'isFavorite', type: 'boolean', required: true, default: false },
        { key: 'isArchived', type: 'boolean', required: true, default: false },
        { key: 'isDeleted', type: 'boolean', required: true, default: false },
      ],
      indexes: [
        { key: 'subject_idx', type: 'key', attributes: ['subject'] },
        { key: 'internal_entity_idx', type: 'key', attributes: ['internalEntityId'] },
        { key: 'creator_idx', type: 'key', attributes: ['createdBy'] },
        { key: 'status_idx', type: 'key', attributes: ['status'] },
        { key: 'archived_idx', type: 'key', attributes: ['isArchived'] },
        { key: 'favorite_idx', type: 'key', attributes: ['isFavorite'] },
        { key: 'deleted_idx', type: 'key', attributes: ['isDeleted'] },
      ],
    },
    {
      id: Collections.EXTERNAL_CONTACTS,
      name: 'External Contacts',
      documentSecurity: true,
      permissions: (orgId: string) => [
        Permission.read(Role.team(orgId)),
        Permission.create(Role.team(orgId)),
        Permission.update(Role.team(orgId)),
        Permission.delete(Role.team(orgId, 'admin')),
      ],
      attributes: [
        { key: 'name', type: 'string', size: 255, required: true },
        { key: 'email', type: 'string', size: 255, required: false },
        { key: 'phone', type: 'string', size: 255, required: false },
        {
          key: 'structureType',
          type: 'enum',
          elements: Object.values(CourierStructureType),
          required: true,
        },
        { key: 'structureName', type: 'string', size: 255, required: false },
        { key: 'idNumber', type: 'string', size: 255, required: false },
        { key: 'address', type: 'string', size: 500, required: false },
        { key: 'createdBy', type: 'string', size: 36, required: true },
      ],
      indexes: [
        { key: 'name_idx', type: 'key', attributes: ['name'] },
        { key: 'structure_type_idx', type: 'key', attributes: ['structureType'] },
        { key: 'creator_idx', type: 'key', attributes: ['createdBy'] },
      ],
    },
  ],
}
