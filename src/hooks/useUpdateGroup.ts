import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { GroupInput } from '@/generated/graphql'

const CREATE_OR_UPDATE_GROUP = gql`
  mutation CreateOrUpdateGroup($input: GroupInput!) {
    createOrUpdateGroup(input: $input) {
      _id
      name
      open
      admins
    }
  }
`

export const useUpdateGroup = () => {
  const [createOrUpdateGroup, { loading }] = useMutation(CREATE_OR_UPDATE_GROUP)
  const { currentUser } = useStore()

  const updateGroup = async (groupData: GroupInput) => {
    const currentUserId = currentUser?._id
    if (!currentUserId) return null

    const { data } = await createOrUpdateGroup({
      variables: {
        input: {
          ...groupData,
          admins: groupData.admins || [currentUserId] // Ensure current user is admin when creating
        }
      },
      refetchQueries: ['GetGroups']
    })

    return data.createOrUpdateGroup
  }

  return { updateGroup, loading }
} 