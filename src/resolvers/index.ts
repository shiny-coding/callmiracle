import { usersQueries } from './usersQueries'
import { groupsQueries } from './groupsQueries'
import { callsQueries } from './callsQueries'
import { meetingsQueries } from './meetingsQueries'
import { notificationsQueries } from './notificationsQueries'
import { conversationsQueries } from './conversationsQueries'
import { updateUserMutation } from './updateUserMutation'
import { callUserMutation } from './callUserMutation'
import { notificationsMutations } from './notificationsMutations'
import { conversationsMutations } from './conversationsMutations'
import { subscriptions } from './subscriptions'
import { dateScalar } from './scalarResolvers'
import { meetingsMutations } from './meetingsMutations'
import groupsMutations from './groupsMutations'
import { deleteUserMutation } from './deleteUserMutation'

export const resolvers = {
  Query: {
    ...usersQueries,
    ...groupsQueries,
    ...callsQueries,
    ...meetingsQueries,
    ...notificationsQueries,
    ...conversationsQueries
  },
  Mutation: {
    updateUser: updateUserMutation,
    callUser: callUserMutation,
    ...meetingsMutations,
    ...groupsMutations,
    ...notificationsMutations,
    ...conversationsMutations,
    deleteUser: deleteUserMutation
  },
  Subscription: {
    ...subscriptions
  },
  Date: dateScalar
}

export default resolvers 