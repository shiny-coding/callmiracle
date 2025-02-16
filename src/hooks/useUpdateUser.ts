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
      hasImage
    }
  }
`

export function useUpdateUser() {
  const [updateUser] = useMutation(UPDATE_USER)
  const userId = getUserId()

  const updateUserData = async (online: boolean = false) => {
    const { name, languages, statuses, setHasImage } = useStore.getState()
    try {
      const result = await updateUser({
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
      setHasImage(result.data?.updateUser?.hasImage || false)
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  return { updateUserData }
} 