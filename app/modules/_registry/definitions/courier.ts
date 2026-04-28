import { Permission, Role } from 'node-appwrite'
import { ModuleDefinition } from '../types.js'

export const courierModule: ModuleDefinition = {
  name: 'courier',
  label: 'Courier Management',
  description: 'Manage incoming and outgoing couriers, assignments, and file attachments.',
  core: false,
  collections: [
    {
      id: 'couriers',
      name: 'Couriers',
      documentSecurity: true,
      permissions: (orgId: string) => [
        Permission.read(Role.team(orgId)),
        Permission.create(Role.team(orgId)),
        Permission.update(Role.team(orgId)),
        Permission.delete(Role.team(orgId, 'admin')),
      ],
      attributes: [
        { key: 'type', type: 'enum', elements: ['incoming', 'outgoing'], required: true, default: 'incoming' },
        { key: 'subject', type: 'string', size: 255, required: true },
        { key: 'sender', type: 'string', size: 255, required: false }, // From for incoming
        { key: 'recipient', type: 'string', size: 255, required: false }, // To for outgoing
        { key: 'assignedTo', type: 'string', size: 36, required: true }, // ID of User or Department
        { key: 'targetType', type: 'enum', elements: ['user', 'department'], required: true, default: 'user' },
        { key: 'fileId', type: 'string', size: 36, required: false },
        { key: 'createdBy', type: 'string', size: 36, required: true },
        { key: 'status', type: 'enum', elements: ['pending', 'received', 'assigned', 'sent', 'completed'], required: true, default: 'pending' },
      ],
      indexes: [
        { key: 'subject_idx', type: 'key', attributes: ['subject'] },
        { key: 'assigned_idx', type: 'key', attributes: ['assignedTo'] },
        { key: 'creator_idx', type: 'key', attributes: ['createdBy'] },
        { key: 'status_idx', type: 'key', attributes: ['status'] },
      ],
    },
  ],
}
