import { useMutation, gql } from '@apollo/client'

const REGENERATE_JOIN_TOKEN = gql`
  mutation RegenerateJoinToken($groupId: ID!) {
    regenerateJoinToken(groupId: $groupId) {
      _id
      name
      description
      open
      owner
      admins
      joinToken
      interestsPairs
      interestsDescriptions {
        interest
        description
      }
    }
  }
`

export function useRegenerateJoinToken() {
  const [regenerateJoinTokenMutation, { loading, error }] = useMutation(REGENERATE_JOIN_TOKEN)

  const regenerateJoinToken = async (groupId: string) => {
    try {
      const result = await regenerateJoinTokenMutation({
        variables: { groupId }
      })
      return result.data?.regenerateJoinToken
    } catch (error) {
      console.error('Error regenerating join token:', error)
      throw error
    }
  }

  return {
    regenerateJoinToken,
    loading,
    error
  }
} 