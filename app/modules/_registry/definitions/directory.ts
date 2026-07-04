import { Permission, Role } from 'node-appwrite'
import { type ModuleDefinition } from '../types.js'
import { Collections } from '#modules/_registry/collection_ids'

export const directoryModule: ModuleDefinition = {
  name: 'directory',
  label: 'Directory & Departments',
  description: 'Manage departments, members, and the organizational chart.',
  core: true,
  collections: [
    {
      id: Collections.DEPARTMENTS,
      name: 'Departments',
      documentSecurity: true,
      permissions: (orgId: string) => [
        Permission.read(Role.team(orgId)),
        Permission.create(Role.team(orgId, 'admin')),
        Permission.update(Role.team(orgId, 'admin')),
        Permission.delete(Role.team(orgId, 'admin')),
      ],
      attributes: [
        { key: 'name', type: 'string', size: 100, required: true },
        { key: 'description', type: 'string', size: 500, required: false },
        { key: 'managerUserId', type: 'string', size: 36, required: false },
      ],
      indexes: [{ key: 'name_idx', type: 'key', attributes: ['name'] }],
    },
    {
      id: Collections.ORG_PROFILES,
      name: 'Org Profiles',
      documentSecurity: true,
      permissions: (orgId: string) => [
        Permission.read(Role.team(orgId)),
        Permission.create(Role.team(orgId, 'admin')),
        Permission.update(Role.team(orgId, 'admin')),
        Permission.delete(Role.team(orgId, 'admin')),
      ],
      attributes: [
        { key: 'userId', type: 'string', size: 36, required: true },
        { key: 'membershipId', type: 'string', size: 36, required: true },
        { key: 'departmentId', type: 'string', size: 36, required: true },
        { key: 'jobTitle', type: 'string', size: 150, required: false },
        { key: 'departmentRole', type: 'enum', elements: ['manager', 'member'], required: true },
      ],
      indexes: [
        { key: 'user_idx', type: 'key', attributes: ['userId'] },
        { key: 'dept_idx', type: 'key', attributes: ['departmentId'] },
        { key: 'manager_idx', type: 'key', attributes: ['departmentId', 'departmentRole'] },
      ],
    },
    {
      id: Collections.NOTIFICATIONS,
      name: 'Notifications',
      documentSecurity: true,
      permissions: (orgId: string) => [
        Permission.read(Role.team(orgId)),
        Permission.create(Role.team(orgId)),
        Permission.update(Role.team(orgId)),
        Permission.delete(Role.team(orgId)),
      ],
      attributes: [
        { key: 'userId', type: 'string', size: 36, required: true },
        { key: 'title', type: 'string', size: 255, required: true },
        { key: 'body', type: 'string', size: 1000, required: true },
        { key: 'link', type: 'string', size: 255, required: false },
        { key: 'isRead', type: 'boolean', required: true, default: false },
        { key: 'createdAt', type: 'datetime', required: true },
        { key: 'senderName', type: 'string', size: 255, required: false },
        { key: 'senderAvatarUrl', type: 'string', size: 500, required: false },
        { key: 'senderId', type: 'string', size: 36, required: false },
      ],
      indexes: [
        { key: 'user_idx', type: 'key', attributes: ['userId'] },
        { key: 'read_idx', type: 'key', attributes: ['isRead'] },
        { key: 'user_read_idx', type: 'key', attributes: ['userId', 'isRead'] },
      ],
    },
  ],
}
