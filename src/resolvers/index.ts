import { usersQueries } from './usersQueries'
import { callsQueries } from './callsQueries'
import { meetingsQueries } from './meetingsQueries'
import { updateUserMutation } from './updateUserMutation'
import { connectWithUserMutation } from './connectWithUserMutation'
import { subscriptions } from './subscriptions'

export const resolvers = {
  Query: {
    ...usersQueries,
    ...callsQueries,
    ...meetingsQueries
  },
  Mutation: {
    updateUser: updateUserMutation,
    connectWithUser: connectWithUserMutation
  },
  Subscription: {
    ...subscriptions
  }
} 