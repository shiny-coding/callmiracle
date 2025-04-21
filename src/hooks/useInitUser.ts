import { gql, useQuery } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { getBrowserLanguage } from '@/utils/language'

export const GET_USER = gql`
  query GetUser($userId: ID!) {
    getUser(userId: $userId) {
      _id
      name
      email
      languages
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
  const { data: session, status } = useSession()
  const { currentUser, setCurrentUser } = useStore()

  const authenticatedUserId = status === 'authenticated' ? session?.user?.id : null

  const { data, loading, error, refetch } = useQuery(GET_USER, {
    variables: { userId: authenticatedUserId || '', },
    skip: status !== 'authenticated' || !authenticatedUserId,
    fetchPolicy: 'network-only',
  })

  useEffect(() => {
    if (data) {
      const user = data.getUser
      if ( !user ) {
        console.log('User not found in database, signing out')
        signOut({ redirect: true, callbackUrl: '/auth/signin' })
      } else {
        setCurrentUser(user)
      }
    }
  }, [data, status, setCurrentUser])

  const isLoading = status === 'loading' || (status === 'authenticated' && loading) || (status === 'authenticated' && !currentUser)

  return { loading: isLoading, error, refetch }
} 