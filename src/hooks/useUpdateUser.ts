import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'

const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
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
    const { currentUser } = useStore.getState()
    
    // Clean blocks data by removing __typename
    const cleanBlocks = currentUser?.blocks?.map(({ userId, all, statuses }) => ({
      userId,
      all,
      statuses
    }))

    await updateUser({
      variables: {
        input: {
          _id: currentUser?._id,
          name: currentUser?.name,
          languages: currentUser?.languages,
          locale: 'en',
          online: currentUser?.online,
          about: currentUser?.about,
          contacts: currentUser?.contacts,
          sex: currentUser?.sex,
          birthYear: currentUser?.birthYear,
          blocks: cleanBlocks
        }
      }
    })
  }

  return { updateUserData }
} 