import { usersQueries } from './usersQueries'
import { callsQueries } from './callsQueries'
import { meetingsQueries } from './meetingsQueries'
import { updateUserMutation } from './updateUserMutation'
import { connectWithUserMutation } from './connectWithUserMutation'
import { meetingsMutations } from './mutations/meetingsMutations'
import { subscriptions } from './subscriptions'

export const resolvers = {
  Query: {
    ...usersQueries,
    ...callsQueries,
    ...meetingsQueries
  },
  Mutation: {
    updateUser: updateUserMutation,
    connectWithUser: connectWithUserMutation,
    ...meetingsMutations,
  },
  Subscription: {
    ...subscriptions
  }
}

export default resolvers 