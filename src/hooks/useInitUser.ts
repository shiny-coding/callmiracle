import { gql, useQuery } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { useEffect } from 'react'
import { getBrowserLanguage } from '@/utils/language'

export const GET_OR_CREATE_USER = gql`
  query GetOrCreateUser($userId: ID!, $defaultLanguages: [String!]!) {
    getOrCreateUser(userId: $userId, defaultLanguages: $defaultLanguages) {
      _id
      name
      languages
      timestamp
      locale
      online
      hasImage
      about
      contacts
      sex
      birthYear
      friends
      blocks {
        userId
        all
        statuses
      }
    }
  }
`

export function useInitUser() {
  const { currentUser, setCurrentUser, setCurrentUserId, currentUserId } = useStore()
  
  const { data, loading, error, refetch } = useQuery(GET_OR_CREATE_USER, {
    variables: { 
      userId: currentUserId || '',
      defaultLanguages: getBrowserLanguage()
    },
    fetchPolicy: 'network-only'
  })

  useEffect(() => {
    if (data?.getOrCreateUser) {
      const user = data.getOrCreateUser
      setCurrentUser(user)
      setCurrentUserId(user._id)
    }
  }, [data]) // it's important to not include currentUser/setCurrentUser/setCurrentUserId in the dependency array, not to trigger unnecessary re-renders

  return { loading: loading || !currentUser, error, refetch }
} 