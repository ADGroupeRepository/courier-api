import { BaseEvent } from '@adonisjs/core/events'

export default class CourierMessageSent extends BaseEvent {
  constructor(
    public readonly orgId: string,
    public readonly courierId: string,
    public readonly senderId: string
  ) {
    super()
  }
}
