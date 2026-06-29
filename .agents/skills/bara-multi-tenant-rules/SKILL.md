---
name: bara-multi-tenant-rules
description: Essential development rules for managing Bara's Appwrite multi-tenant environment, authorization guardrails, and isolated storage/database access.
---

# Bara Multi-Tenant Rules Skill

Use this skill whenever you write or modify controllers, services, or middleware that handle organization resources, permissions, or members.

## 1. Safety Guardrails & Role Protections

- **Owner Role Protection**: The `'owner'` role is a special privilege. Standard admins (users with only the `'admin'` role) must never be permitted to modify, demote, or remove a member who possesses the `'owner'` role.
- **Role Preservation**: When updating organization-level roles for a member who is an `'owner'`, the `'owner'` role must be merged and preserved in the final roles array (e.g., updating to `'admin'` results in `['owner', 'admin']` to prevent accidental demotion).
- **Owner Deletion**: Members with the `'owner'` role cannot be deleted or removed from the organization. They must transfer ownership first.
- **Secretariat Role**: Reception/mailroom staff who register incoming couriers. They can create/manage external contacts (correspondents) and register incoming couriers but **cannot** perform admin operations.

## 2. Resource Isolation (Isolated Database & Storage)

- **Database & Buckets**: Never hardcode database or bucket IDs for tenant resources. Always resolve them dynamically from team preferences (`prefs.databaseId` and `prefs.bucketId`).
- **Storage JWT / Security Masking**: Appwrite Storage returns a `404 storage_file_not_found` error for authorization or permission failures instead of a `403` to prevent ID enumeration. Always ensure requests to download or view files include the necessary headers (`X-Appwrite-Project`, `X-Appwrite-JWT`) or active session cookies.

## 3. Member Directory Lookup & Resolution

- **Lookup Fields**: When querying, updating, or removing organization members, endpoints must resolve the target membership exclusively using the `userId` (searching Appwrite memberships list) to keep lookups clean and standardized. Do not query by Appwrite `membershipId`.

## 4. Authorization & Middleware checks

- **HttpContext Flags**: Rely on `isOrgAdmin`, `isOrgSecretariat`, and `isOrgOwner` attached to `HttpContext` by the `OrgAuthMiddleware` instead of manually listing memberships in every controller.
- **Route Chains**: Ensure that any endpoint inside `/organisations/:orgId/...` runs `middleware.orgAuth()` before performing database actions.
