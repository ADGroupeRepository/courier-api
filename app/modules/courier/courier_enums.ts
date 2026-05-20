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
}

export enum CourierStructureType {
  PHYSIQUE = 'physique',
  PRIVEE = 'privee',
  PUBLIQUE = 'publique',
  ONG = 'ong',
  AUTRE = 'autre',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
}
