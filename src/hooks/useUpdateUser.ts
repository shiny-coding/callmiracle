import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { UserInput } from '@/generated/graphql'

const UPDATE_USER = gql`
  mutation UpdateUser($input: UserInput!) {
    updateUser(input: $input) { _id }
  }
`

// Helper function to remove __typename recursively (optional but robust)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const removeTypename = <T>(value: T): Omit<T, '__typename'> => {
  if (value !== null && typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newValue: any = Array.isArray(value) ? [] : {}
    for (const key in value) {
      if (key !== '__typename') {
        newValue[key] = removeTypename(value[key])
      }
    }
    return newValue as Omit<T, '__typename'>
  }
  return value as Omit<T, '__typename'>
}


export const useUpdateUser = () => {
  const [updateUser, { loading }] = useMutation(UPDATE_USER)
  const updateUserData = async () => {
    const { currentUser } = useStore.getState()

    if (!currentUser) {
      return
    }

    const input: UserInput = {
      _id: currentUser._id,
      name: currentUser.name,
      languages: currentUser.languages,
      locale: 'en',
      online: currentUser.online,
      about: currentUser.about,
      contacts: currentUser.contacts,
      sex: currentUser.sex,
      birthYear: currentUser.birthYear,
      blocks: currentUser.blocks,
      friends: currentUser.friends
    }

    await updateUser({
      variables: { input: removeTypename(input) }
    })
  }

  return { updateUserData, loading }
} 