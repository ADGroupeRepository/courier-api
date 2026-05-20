import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.profile': { paramsTuple?: []; params?: {} }
    'auth.upload_avatar': { paramsTuple?: []; params?: {} }
    'auth.delete_avatar': { paramsTuple?: []; params?: {} }
    'organisations.index': { paramsTuple?: []; params?: {} }
    'organisations.store': { paramsTuple?: []; params?: {} }
    'organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.upload_logo': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisations.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisations.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'members.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'org_licenses.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'org_licenses.assign': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'org_licenses.revoke': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.index_available': { paramsTuple?: []; params?: {} }
    'organisation_modules.index_active': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.activate': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.deactivate': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'module': ParamValue} }
    'admin_marketplace.publish': { paramsTuple?: []; params?: {} }
    'admin_marketplace.unpublish': { paramsTuple: [ParamValue]; params: {'moduleName': ParamValue} }
    'admin_plans.index_plans': { paramsTuple?: []; params?: {} }
    'admin_plans.store_plan': { paramsTuple?: []; params?: {} }
    'admin_plans.update_plan': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'admin_plans.destroy_plan': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'admin_plans.plan_usage': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'admin_plans.index_subscriptions': { paramsTuple?: []; params?: {} }
    'admin_plans.issue_subscription': { paramsTuple?: []; params?: {} }
    'admin_plans.update_subscription': { paramsTuple: [ParamValue]; params: {'subscriptionId': ParamValue} }
    'departments.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'departments.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'departments.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'departments.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'departments.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'department_members.assign': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'membershipId': ParamValue} }
    'department_members.index_by_department': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'department_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'courier.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'courier.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.force_destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_chat.index': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_chat.store': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_replies.index': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_replies.store': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_replies.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue,'replyId': ParamValue} }
    'external_contacts.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'external_contacts.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'external_contacts.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'external_contacts.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'external_contacts.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'plans.index': { paramsTuple?: []; params?: {} }
    'plans.show': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'plans.org_subscription': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'plans.subscribe': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
  }
  POST: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.upload_avatar': { paramsTuple?: []; params?: {} }
    'organisations.store': { paramsTuple?: []; params?: {} }
    'organisations.upload_logo': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'members.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'org_licenses.assign': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'org_licenses.revoke': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.activate': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'admin_marketplace.publish': { paramsTuple?: []; params?: {} }
    'admin_plans.store_plan': { paramsTuple?: []; params?: {} }
    'admin_plans.issue_subscription': { paramsTuple?: []; params?: {} }
    'departments.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'department_members.assign': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'membershipId': ParamValue} }
    'courier.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'courier.restore': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_chat.store': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_replies.store': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'external_contacts.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'plans.subscribe': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
  }
  GET: {
    'auth.profile': { paramsTuple?: []; params?: {} }
    'organisations.index': { paramsTuple?: []; params?: {} }
    'organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'org_licenses.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.index_available': { paramsTuple?: []; params?: {} }
    'organisation_modules.index_active': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'admin_plans.index_plans': { paramsTuple?: []; params?: {} }
    'admin_plans.plan_usage': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'admin_plans.index_subscriptions': { paramsTuple?: []; params?: {} }
    'departments.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'departments.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'department_members.index_by_department': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'courier.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_chat.index': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_replies.index': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'external_contacts.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'external_contacts.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'plans.index': { paramsTuple?: []; params?: {} }
    'plans.show': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'plans.org_subscription': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
  }
  HEAD: {
    'auth.profile': { paramsTuple?: []; params?: {} }
    'organisations.index': { paramsTuple?: []; params?: {} }
    'organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'org_licenses.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.index_available': { paramsTuple?: []; params?: {} }
    'organisation_modules.index_active': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'admin_plans.index_plans': { paramsTuple?: []; params?: {} }
    'admin_plans.plan_usage': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'admin_plans.index_subscriptions': { paramsTuple?: []; params?: {} }
    'departments.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'departments.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'department_members.index_by_department': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'courier.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_chat.index': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_replies.index': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'external_contacts.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'external_contacts.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'plans.index': { paramsTuple?: []; params?: {} }
    'plans.show': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'plans.org_subscription': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
  }
  DELETE: {
    'auth.delete_avatar': { paramsTuple?: []; params?: {} }
    'organisations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisation_modules.deactivate': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'module': ParamValue} }
    'admin_marketplace.unpublish': { paramsTuple: [ParamValue]; params: {'moduleName': ParamValue} }
    'admin_plans.destroy_plan': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'departments.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'department_members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.force_destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'external_contacts.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
  }
  PUT: {
    'organisations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'departments.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
  }
  PATCH: {
    'organisations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'admin_plans.update_plan': { paramsTuple: [ParamValue]; params: {'planId': ParamValue} }
    'admin_plans.update_subscription': { paramsTuple: [ParamValue]; params: {'subscriptionId': ParamValue} }
    'departments.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
    'courier_replies.update': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue,'replyId': ParamValue} }
    'external_contacts.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}