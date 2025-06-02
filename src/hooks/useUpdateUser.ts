import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { UserInput } from '@/generated/graphql'

const UPDATE_USER = gql`
  mutation UpdateUser($input: UserInput!) {
    updateUser(input: $input) { _id, updatedAt }
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
  const [updateUser, { data, loading }] = useMutation(UPDATE_USER)
  const { currentUser, setCurrentUser } = useStore( (state: any) => ({
    currentUser: state.currentUser,
    setCurrentUser: state.setCurrentUser
  }))

  const updateUserData = async () => {
    if (!currentUser) {
      return
    }

    const input: UserInput = {
      _id: currentUser._id,
      name: currentUser.name,
      languages: currentUser.languages,
      about: currentUser.about,
      contacts: currentUser.contacts,
      sex: currentUser.sex,
      birthYear: currentUser.birthYear,
      blocks: currentUser.blocks,
      friends: currentUser.friends
    }

    const result = await updateUser({
      variables: { input: removeTypename(input) }
    })
    if (result.data?.updateUser) {
      setCurrentUser({
        ...currentUser,
        ...result.data.updateUser
      })
    }
  }

  return { updateUserData, loading }
} 