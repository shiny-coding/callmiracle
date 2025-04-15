import { usersQueries } from './usersQueries'
import { callsQueries } from './callsQueries'
import { meetingsQueries } from './meetingsQueries'
import { notificationsQueries } from './notificationsQueries'
import { updateUserMutation } from './updateUserMutation'
import { callUserMutation } from './callUserMutation'
import { notificationsMutations } from './notificationsMutations'
import { subscriptions } from './subscriptions'
import { dateScalar } from './scalarResolvers'
import { meetingsMutations } from './meetingsMutations'
import { deleteUserMutation } from './deleteUserMutation'

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
    ...notificationsMutations,
    deleteUser: deleteUserMutation
  },
  Subscription: {
    ...subscriptions
  },
  Date: dateScalar
}

export default resolvers 