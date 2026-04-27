import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
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
    'organisations.members.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisations.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisations.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisation_modules.index_available': { paramsTuple?: []; params?: {} }
    'organisation_modules.index_active': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.activate': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.deactivate': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'module': ParamValue} }
    'admin_marketplace.publish': { paramsTuple?: []; params?: {} }
    'admin_marketplace.unpublish': { paramsTuple: [ParamValue]; params: {'moduleName': ParamValue} }
  }
  POST: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.upload_avatar': { paramsTuple?: []; params?: {} }
    'organisations.store': { paramsTuple?: []; params?: {} }
    'organisations.upload_logo': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisation_modules.activate': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'admin_marketplace.publish': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'auth.profile': { paramsTuple?: []; params?: {} }
    'organisations.index': { paramsTuple?: []; params?: {} }
    'organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisation_modules.index_available': { paramsTuple?: []; params?: {} }
    'organisation_modules.index_active': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
  }
  HEAD: {
    'auth.profile': { paramsTuple?: []; params?: {} }
    'organisations.index': { paramsTuple?: []; params?: {} }
    'organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisation_modules.index_available': { paramsTuple?: []; params?: {} }
    'organisation_modules.index_active': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
  }
  DELETE: {
    'auth.delete_avatar': { paramsTuple?: []; params?: {} }
    'organisations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
    'organisation_modules.deactivate': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'module': ParamValue} }
    'admin_marketplace.unpublish': { paramsTuple: [ParamValue]; params: {'moduleName': ParamValue} }
  }
  PUT: {
    'organisations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
  }
  PATCH: {
    'organisations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.update': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}