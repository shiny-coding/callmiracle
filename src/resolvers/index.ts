import { usersQueries } from './usersQueries'
import { callsQueries } from './callsQueries'
import { meetingsQueries } from './meetingsQueries'
import { notificationsQueries } from './notificationsQueries'
import { updateUserMutation } from './updateUserMutation'
import { connectWithUserMutation } from './connectWithUserMutation'
import meetingsMutations from './mutations/meetingsMutations'
import { notificationsMutations } from './mutations/notificationsMutations'
import { subscriptions } from './subscriptions'

export const resolvers = {
  Query: {
    ...usersQueries,
    ...callsQueries,
    ...meetingsQueries,
    ...notificationsQueries
  },
  Mutation: {
    updateUser: updateUserMutation,
    connectWithUser: connectWithUserMutation,
    ...meetingsMutations,
    ...notificationsMutations
  },
  Subscription: {
    ...subscriptions
  }
}

export default resolvers 