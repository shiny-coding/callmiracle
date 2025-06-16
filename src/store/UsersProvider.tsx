'use client'

import { createContext, useContext, ReactNode } from 'react'
import { gql, useQuery } from '@apollo/client'
import { User } from '@/generated/graphql'
import { useStore } from './useStore'

const GET_USERS = gql`
  query GetUsers {
    getUsers {
      _id
      name
      languages
      about
      contacts
      sex
      groups
    }
  }
`

interface UsersContextType {
  users: User[] | undefined
  loading: boolean
  error: any
  refetch: () => Promise<any>
}

const UsersContext = createContext<UsersContextType | null>(null)

export function useUsers() {
  const context = useContext(UsersContext)
  if (!context) {
    throw new Error('useUsers must be used within a UsersProvider')
  }
  return context
}

interface UsersProviderProps {
  children: ReactNode
}

export function UsersProvider({ children }: UsersProviderProps) {
  const { data, loading, error, refetch } = useQuery(GET_USERS)
  
  const users = data?.getUsers || []

  return (
    <UsersContext.Provider value={{ users, loading, error, refetch }}>
      {children}
    </UsersContext.Provider>
  )
} 