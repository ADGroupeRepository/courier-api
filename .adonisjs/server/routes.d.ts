import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
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
  }
  POST: {
    'auth.signup': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.upload_avatar': { paramsTuple?: []; params?: {} }
    'organisations.store': { paramsTuple?: []; params?: {} }
    'organisations.upload_logo': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.store': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
  }
  GET: {
    'auth.me': { paramsTuple?: []; params?: {} }
    'organisations.index': { paramsTuple?: []; params?: {} }
    'organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
  }
  HEAD: {
    'auth.me': { paramsTuple?: []; params?: {} }
    'organisations.index': { paramsTuple?: []; params?: {} }
    'organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.index': { paramsTuple: [ParamValue]; params: {'orgId': ParamValue} }
    'organisations.members.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
  }
  DELETE: {
    'auth.delete_avatar': { paramsTuple?: []; params?: {} }
    'organisations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'organisations.members.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'orgId': ParamValue,'memberId': ParamValue} }
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