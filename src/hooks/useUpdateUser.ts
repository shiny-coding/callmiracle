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
      sex
      birthYear
      allowedMales
      allowedFemales
      allowedMinAge
      allowedMaxAge
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
          statuses: user?.statuses,
          locale: 'en',
          online: user?.online,
          about: user?.about,
          contacts: user?.contacts,
          sex: user?.sex,
          birthYear: user?.birthYear,
          allowedMales: user?.allowedMales,
          allowedFemales: user?.allowedFemales,
          allowedMinAge: user?.allowedMinAge,
          allowedMaxAge: user?.allowedMaxAge,
          blocks: cleanBlocks
        }
      }
    })
  }

  return { updateUserData }
} 