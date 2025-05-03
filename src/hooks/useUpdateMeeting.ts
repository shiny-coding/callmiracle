import { gql, useMutation } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { Interest } from '@/generated/graphql'

const CREATE_OR_UPDATE_MEETING = gql`
  mutation CreateOrUpdateMeeting($input: MeetingInput!) {
    createOrUpdateMeeting(input: $input) {
      _id
      userId
      userName
      interests
      timeSlots
      minDuration
      preferEarlier
      allowedMales
      allowedFemales
      allowedMinAge
      allowedMaxAge
      languages
      startTime
      peerMeetingId
    }
  }
`

export const useUpdateMeeting = () => {
  const [createOrUpdateMeeting, { loading }] = useMutation(CREATE_OR_UPDATE_MEETING)

  const { currentUser } = useStore()

  const updateMeeting = async (meetingData: {
    _id?: string
    interests: Interest[]
    timeSlots: number[]
    minDuration: number
    preferEarlier: boolean
    allowedMales: boolean
    allowedFemales: boolean
    allowedMinAge: number
    allowedMaxAge: number
    languages: string[]
    startTime?: number
    peerMeetingId?: string
  }) => {
    const currentUserId = currentUser?._id
    if (!currentUserId) return null

    const { data } = await createOrUpdateMeeting({
      variables: {
        input: {
          _id: meetingData._id,
          userId: currentUserId,
          userName: currentUser?.name,
          ...meetingData
        }
      },
      refetchQueries: ['GetMeetingsWithPeers']
    })

    return data.createOrUpdateMeeting
  }

  return { updateMeeting, loading }
} 