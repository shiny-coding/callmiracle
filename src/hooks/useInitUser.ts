import { gql, useQuery } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import { useEffect } from 'react'
import { getBrowserLanguage } from '@/utils/language'

export const GET_OR_CREATE_USER = gql`
  query GetOrCreateUser($userId: ID!, $defaultLanguages: [String!]!) {
    getOrCreateUser(userId: $userId, defaultLanguages: $defaultLanguages) {
      userId
      name
      statuses
      languages
      timestamp
      locale
      online
      hasImage
    }
  }
`

export function useInitUser() {
  const userId = getUserId()
  const { setName, setLanguages, setStatuses, setHasImage } = useStore()
  
  const { data, loading, error, refetch } = useQuery(GET_OR_CREATE_USER, {
    variables: { 
      userId,
      defaultLanguages: getBrowserLanguage()
    },
    fetchPolicy: 'network-only'
  })

  useEffect(() => {
    if (data?.getOrCreateUser) {
      const user = data.getOrCreateUser
      setName(user.name || '')
      setLanguages(user.languages || [])
      setStatuses(user.statuses || [])
      setHasImage(user.hasImage || false)
    }
  }, [data, setName, setLanguages, setStatuses, setHasImage])

  return { loading, error, refetch }
} 