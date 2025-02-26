import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { getUserId } from '@/lib/userId'

const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
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
      birthYear
      blocks {
        userId
        all
        statuses
      }
    }
  }
`

export const useUpdateUser = () => {
  const [updateUser] = useMutation(UPDATE_USER)

  const updateUserData = async () => {
    const userId = getUserId()
    if (!userId) return
    const { 
      user
    } = useStore.getState()
  
    // Clean blocks data by removing __typename
    const cleanBlocks = user?.blocks?.map(({ userId, all, statuses }) => ({
      userId,
      all,
      statuses
    }))

    await updateUser({
      variables: {
        input: {
          userId,
          name: user?.name,
          languages: user?.languages,
          locale: 'en',
          online: user?.online,
          about: user?.about,
          contacts: user?.contacts,
          sex: user?.sex,
          birthYear: user?.birthYear,
          blocks: cleanBlocks
        }
      }
    })
  }

  return { updateUserData }
} 