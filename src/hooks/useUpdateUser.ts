import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { getUserId } from '@/lib/userId'

const UPDATE_USER = gql`
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
      about
      contacts
    }
  }
`

export const useUpdateUser = () => {
  const [updateUser] = useMutation(UPDATE_USER)

  const updateUserData = async () => {
    const userId = getUserId()
    if (!userId) return
    const { 
      name, 
      languages, 
      statuses, 
      online,
      about,
      contacts 
    } = useStore.getState()
  
    await updateUser({
      variables: {
        input: {
          userId,
          name,
          languages,
          statuses,
          locale: 'en',
          online,
          about,
          contacts
        }
      }
    })
  }

  return { updateUserData }
} 