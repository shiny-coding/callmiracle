'use client'

import { createContext, useContext, ReactNode } from 'react'
import { gql, useQuery } from '@apollo/client'
import { Group } from '@/generated/graphql'
import { useStore } from './useStore'

const GET_GROUPS = gql`
  query GetGroups($userId: ID!) {
    getGroups(userId: $userId) {
      _id
      name
      description
      open
      transparency
      owner
      admins
      joinToken
      usersCount
      interestsPairs
      interestsDescriptions {
        interest
        description
      }
    }
  }
`

interface GroupsContextType {
  groups: Group[] | undefined
  loading: boolean
  error: any
  refetch: () => Promise<any>
}

const GroupsContext = createContext<GroupsContextType | null>(null)

export function useGroups() {
  const context = useContext(GroupsContext)
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider')
  }
  return context
}

interface GroupsProviderProps {
  children: ReactNode
}

export function GroupsProvider({ children }: GroupsProviderProps) {
  const currentUser = useStore(state => state.currentUser)
  const { data, loading, error, refetch } = useQuery(GET_GROUPS, {
    variables: { userId: currentUser?._id },
    skip: !currentUser?._id
  })
  const groups = data?.getGroups || []

  return (
    <GroupsContext.Provider value={{ groups, loading, error, refetch }}>
      {children}
    </GroupsContext.Provider>
  )
} 