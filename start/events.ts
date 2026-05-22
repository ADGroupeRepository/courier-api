import emitter from '@adonisjs/core/services/emitter'
import CourierAssigned from '#events/courier_assigned'
import CourierMessageSent from '#events/courier_message_sent'
import CourierReplySent from '#events/courier_reply_sent'
import OrganisationCreated from '#events/organisation_created'

const NotificationListener = () => import('#listeners/notification_listener')
const OrganisationListener = () => import('#listeners/organisation_listener')

emitter.on(CourierAssigned, [NotificationListener, 'onCourierAssigned'])
emitter.on(CourierMessageSent, [NotificationListener, 'onCourierMessageSent'])
emitter.on(CourierReplySent, [NotificationListener, 'onCourierReplySent'])
emitter.on(OrganisationCreated, [OrganisationListener, 'onOrganisationCreated'])
