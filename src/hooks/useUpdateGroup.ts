import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { GroupInput } from '@/generated/graphql'
import { removeTypename } from './useUpdateUser'

const CREATE_OR_UPDATE_GROUP = gql`
  mutation CreateOrUpdateGroup($input: GroupInput!) {
    createOrUpdateGroup(input: $input) {
      _id
      name
      description
      open
      admins
      interestsPairs
      interestsDescriptions {
        interest
        description
      }
    }
  }
`

const DELETE_GROUP_MUTATION = gql`
  mutation DeleteGroup($id: ID!) {
    deleteGroup(id: $id)
  }
`

export const useUpdateGroup = () => {
  const [createOrUpdateGroup, { loading }] = useMutation(CREATE_OR_UPDATE_GROUP)
  const [deleteGroupMutation, { loading: deleteLoading }] = useMutation(DELETE_GROUP_MUTATION)
  const { currentUser } = useStore(state => ({ currentUser: state.currentUser }))

  const updateGroup = async (groupData: GroupInput) => {
    const currentUserId = currentUser?._id
    if (!currentUserId) return null

    // Clean the data to remove __typename fields
    const cleanGroupData = removeTypename({
      ...groupData,
      admins: groupData.admins || [currentUserId] // Ensure current user is admin when creating
    })

    const { data } = await createOrUpdateGroup({
      variables: {
        input: cleanGroupData
      },
      refetchQueries: ['GetGroups']
    })

    return data.createOrUpdateGroup
  }

  const deleteGroup = async (id: string): Promise<boolean> => {
    try {
      const { data } = await deleteGroupMutation({
        variables: { id }
      })
      return data?.deleteGroup
    } catch (error) {
      console.error('Error deleting group:', error)
      throw error
    }
  }

  return { 
    updateGroup, 
    deleteGroup,
    loading: loading || deleteLoading 
  }
} 