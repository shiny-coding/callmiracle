import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { MeetingInput } from '@/generated/graphql'

const CREATE_OR_UPDATE_MEETING = gql`
  mutation CreateOrUpdateMeeting($input: MeetingInput!) {
    createOrUpdateMeeting(input: $input) {
      meeting {
        _id
        userId
        userName
        interests
        timeSlots
        minDurationM
        preferEarlier
        allowedMales
        allowedFemales
        allowedMinAge
        allowedMaxAge
        languages
        startTime
        peerMeetingId
      }
      error
    }
  }
`

export const useUpdateMeeting = () => {
  const [createOrUpdateMeeting, { loading }] = useMutation(CREATE_OR_UPDATE_MEETING)

  const { currentUser } = useStore(state => ({ currentUser: state.currentUser }))

  const updateMeeting = async (meetingData: MeetingInput) => {
    const currentUserId = currentUser?._id
    if (!currentUserId) return null

    const { data } = await createOrUpdateMeeting({
      variables: {
        input: {
          ...meetingData,
          userId: currentUserId,
          userName: currentUser?.name,
        }
      },
      refetchQueries: ['GetMeetingsWithPeers']
    })

    return data.createOrUpdateMeeting
  }

  return { updateMeeting, loading }
} 