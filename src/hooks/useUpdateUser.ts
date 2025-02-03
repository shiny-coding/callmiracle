import { gql, useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'

export const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      userId
      name
      statuses
      languages
      timestamp
      locale
      online
    }
  }
`

export function useUpdateUser() {
  const [updateUser] = useMutation(UPDATE_USER)
  const { name, languages, statuses } = useStore()
  const userId = getUserId()

  const updateUserData = async (online: boolean = false) => {
    try {
      await updateUser({
        variables: {
          input: {
            userId,
            name,
            statuses,
            languages,
            locale: navigator.language,
            online
          }
        }
      })
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  return { updateUserData }
} 