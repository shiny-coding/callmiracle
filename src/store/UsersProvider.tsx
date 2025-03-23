'use client'

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { gql, useQuery } from '@apollo/client'
import { User } from '@/generated/graphql'

const GET_USERS = gql`
  query GetUsers {
    users {
      userId
      name
      languages
      timestamp
      locale
      online
      hasImage
      about
      contacts
      sex
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
  const users = data?.users || []

  return (
    <UsersContext.Provider value={{ users, loading, error, refetch }}>
      {children}
    </UsersContext.Provider>
  )
} 