import { gql, useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'

const CREATE_OR_UPDATE_MEETING = gql`
  mutation CreateOrUpdateMeeting($input: MeetingPlanInput!) {
    createOrUpdateMeeting(input: $input) {
      _id
      userId
      statuses
      timeSlots
      minDuration
      preferEarlier
      allowedMales
      allowedFemales
      allowedMinAge
      allowedMaxAge
      languages
    }
  }
`

export const useUpdateMeeting = () => {
  const [createOrUpdateMeeting, { loading }] = useMutation(CREATE_OR_UPDATE_MEETING)

  const updateMeeting = async (meetingData: {
    _id?: string
    statuses: string[]
    timeSlots: number[]
    minDuration: number
    preferEarlier: boolean
    allowedMales: boolean
    allowedFemales: boolean
    allowedMinAge: number
    allowedMaxAge: number
    languages: string[]
  }) => {
    const userId = getUserId()
    if (!userId) return null

    const { data } = await createOrUpdateMeeting({
      variables: {
        input: {
          _id: meetingData._id,
          userId,
          ...meetingData
        }
      },
      refetchQueries: ['GetMeetings']
    })

    return data.createOrUpdateMeeting
  }

  return { updateMeeting, loading }
} 