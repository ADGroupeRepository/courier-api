export enum CourierUrgency {
  NORMAL = 'normal',
  URGENT = 'urgent',
  VERY_URGENT = 'very_urgent',
}

export enum CourierStatus {
  PENDING = 'pending',
  RECEIVED = 'received',
  ASSIGNED = 'assigned',
  SENT = 'sent',
  COMPLETED = 'completed',
}

export enum CourierType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  INTERNAL = 'internal',
}

export enum CourierCustodyState {
  COURIER_SERVICE = 'courier_service',
  SENDER = 'sender',
  RECIPIENT = 'recipient',
  DISPATCHED = 'dispatched',
}

export enum CourierStructureType {
  PERSONNE = 'personne',
  ENTREPRISE_PRIVEE = 'entreprise_privee',
  ORGANISATION_PUBLIQUE = 'organisation_publique',
  ONG = 'ONG',
  AUTRE = 'autre',
}
