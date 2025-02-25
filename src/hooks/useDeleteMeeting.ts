import { getUserId } from '@/lib/userId'
import { useMutation, gql } from '@apollo/client'

const DELETE_MEETING = gql`
  mutation DeleteMeeting($id: ID!) {
    deleteMeeting(id: $id) {
      _id
    }
  }
`

export function useDeleteMeeting() {
  const [deleteMeetingMutation, { loading, error }] = useMutation(DELETE_MEETING)

  const deleteMeeting = async (id: string) => {
    try {
      const result = await deleteMeetingMutation({
        variables: {
          id,
        }
      })
      return result.data.deleteMeeting
    } catch (err) {
      console.error('Error deleting meeting:', err)
      throw err
    }
  }

  return { deleteMeeting, loading, error }
} 