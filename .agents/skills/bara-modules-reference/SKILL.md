---
name: bara-modules-reference
description: Quick-reference map for all Bara SaaS backend modules, collections, controllers, and routes to avoid scanning directories and save context tokens.
---

# Bara Modules Reference Skill

Use this skill as a fast reference to navigate and modify module systems in `bara-api`. Instead of performing recursive directories lookups or viewing registry definition files, use this map.

## 1. Core Module Registration

- **Registry & Definitions Directory**: [definitions](file:///d:/Projects/Backend/bara-api/app/modules/_registry/definitions)
- **Active Registry Mapping**: [module_registry.ts](file:///d:/Projects/Backend/bara-api/app/modules/_registry/module_registry.ts)
- **Centralized Collection Names**: [collection_ids.ts](file:///d:/Projects/Backend/bara-api/app/modules/_registry/collection_ids.ts)
- **Central Provisioning Coordinator**: [provisioning_service.ts](file:///d:/Projects/Backend/bara-api/app/modules/_registry/provisioning_service.ts)

---

## 2. Directory Module (`directory`) [Core]

*Manages organization members, department mapping, and profiles.*

- **Database Collections**: 
  - `departments` (Key: Collections.DEPARTMENTS)
  - `org_profiles` (Key: Collections.ORG_PROFILES)
  - `notifications` (Key: Collections.NOTIFICATIONS)
- **Routing**: [directory.ts](file:///d:/Projects/Backend/bara-api/start/routes/directory.ts)
- **Controllers & Services**:
  - `MembersController` -> [members_controller.ts](file:///d:/Projects/Backend/bara-api/app/modules/organisations/members_controller.ts)
  - `MembersService` -> [members_service.ts](file:///d:/Projects/Backend/bara-api/app/modules/directory/members_service.ts)
  - `DepartmentMembersController` -> [department_members_controller.ts](file:///d:/Projects/Backend/bara-api/app/modules/directory/department_members_controller.ts)

---

## 3. Courier Module (`courier`)

*Manages internal, incoming, and outgoing couriers, handovers, and chats.*

- **Database Collections**:
  - `couriers` (Key: Collections.COURIERS)
  - `courier_assignments` (Key: Collections.COURIER_ASSIGNMENTS)
  - `courier_replies` (Key: Collections.COURIER_REPLIES)
  - `courier_messages` (Key: Collections.COURIER_MESSAGES)
  - `courier_activities` (Key: Collections.COURIER_ACTIVITIES)
  - `external_contacts` (Key: Collections.EXTERNAL_CONTACTS)
- **Routing**:
  - Courier routes -> [courier.ts](file:///d:/Projects/Backend/bara-api/start/routes/courier.ts)
  - External Contacts routes -> [external_contacts.ts](file:///d:/Projects/Backend/bara-api/start/routes/external_contacts.ts)
- **Controllers & Services**:
  - `CourierController` -> [courier_controller.ts](file:///d:/Projects/Backend/bara-api/app/modules/courier/courier_controller.ts)
  - `CourierService` -> [courier_service.ts](file:///d:/Projects/Backend/bara-api/app/modules/courier/courier_service.ts)
  - `CourierRepliesController` -> [courier_replies_controller.ts](file:///d:/Projects/Backend/bara-api/app/modules/courier/courier_replies_controller.ts)
  - `CourierReplyService` -> [courier_reply_service.ts](file:///d:/Projects/Backend/bara-api/app/modules/courier/courier_reply_service.ts)
  - `ExternalContactsController` -> [external_contacts_controller.ts](file:///d:/Projects/Backend/bara-api/app/modules/external_contacts/external_contacts_controller.ts)
  - `ExternalContactService` -> [external_contact_service.ts](file:///d:/Projects/Backend/bara-api/app/modules/external_contacts/external_contact_service.ts)

---

## 4. Plans & Subscriptions Module (`bara-platform` database)

*System-wide licensing, plans, and tenant limits.*

- **Database Collections**:
  - `plans` (Key: Collections.PLANS)
  - `subscriptions` (Key: Collections.SUBSCRIPTIONS)
  - `licenses` (Key: Collections.LICENSES)
- **Routing**: [plans.ts](file:///d:/Projects/Backend/bara-api/start/routes/plans.ts)
- **Controllers & Services**:
  - `OrgLicensesController` -> [org_licenses_controller.ts](file:///d:/Projects/Backend/bara-api/app/modules/organisations/org_licenses_controller.ts)
  - `PlanService` -> [plan_service.ts](file:///d:/Projects/Backend/bara-api/app/modules/plans/plan_service.ts)

---

## Usage Tip

When asked to modify, view, or extend a module, look up this file first (`bara-modules-reference`) and jump directly to the target file links instead of doing fuzzy file searches.
