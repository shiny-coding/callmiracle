import { usersQueries } from './usersQueries'
import { callsQueries } from './callsQueries'
import { meetingsQueries } from './meetingsQueries'
import { notificationsQueries } from './notificationsQueries'
import { updateUserMutation } from './updateUserMutation'
import { callUserMutation } from './callUserMutation'
import meetingsMutations from './meetingsMutations'
import { notificationsMutations } from './notificationsMutations'
import { subscriptions } from './subscriptions'
import { dateScalar } from './scalarResolvers'

export const resolvers = {
  Query: {
    ...usersQueries,
    ...callsQueries,
    ...meetingsQueries,
    ...notificationsQueries
  },
  Mutation: {
    updateUser: updateUserMutation,
    callUser: callUserMutation,
    ...meetingsMutations,
    ...notificationsMutations
  },
  Subscription: {
    ...subscriptions
  },
  Date: dateScalar
}

export default resolvers 