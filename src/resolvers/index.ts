import { usersQueries } from './queries/users'
import { callsQueries } from './queries/calls'
import { meetingsQueries } from './queries/meetings'
import { usersMutations } from './mutations/users'
import { connectionMutations } from './mutations/connections'
import { subscriptions } from './subscriptions'

export const resolvers = {
  Query: {
    ...usersQueries,
    ...callsQueries,
    ...meetingsQueries
  },
  Mutation: {
    ...usersMutations,
    ...connectionMutations
  },
  Subscription: {
    ...subscriptions
  }
} 