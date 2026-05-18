import { BaseEvent } from '@adonisjs/core/events'

export default class CourierAssigned extends BaseEvent {
  constructor(
    public readonly orgId: string,
    public readonly courierId: string,
    public readonly targetType: 'user' | 'department',
    public readonly targetId: string
  ) {
    super()
  }
}
