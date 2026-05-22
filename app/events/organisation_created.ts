import { BaseEvent } from '@adonisjs/core/events'

export default class OrganisationCreated extends BaseEvent {
  constructor(public readonly orgId: string) {
    super()
  }
}
