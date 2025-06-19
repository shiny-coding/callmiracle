import { useMutation, gql } from '@apollo/client'

const REMOVE_USER_FROM_GROUP = gql`
  mutation RemoveUserFromGroup($groupId: ID!, $userId: ID!) {
    removeUserFromGroup(groupId: $groupId, userId: $userId)
  }
`

export function useRemoveUserFromGroup() {
  const [removeUserFromGroupMutation, { loading, error }] = useMutation(REMOVE_USER_FROM_GROUP)

  const removeUserFromGroup = async (groupId: string, userId: string) => {
    try {
      const result = await removeUserFromGroupMutation({
        variables: { groupId, userId },
        refetchQueries: ['GetUsers', 'GetGroups']
      })
      return result.data?.removeUserFromGroup
    } catch (error) {
      console.error('Error removing user from group:', error)
      throw error
    }
  }

  return {
    removeUserFromGroup,
    loading,
    error
  }
} 