import { LANGUAGES } from "@/config/languages";
import { Meeting, MeetingWithPeer } from "@/generated/graphql";
import { useStore } from "@/store/useStore";
import { getSharedLanguages } from "@/utils/meetingUtils";
import { gql } from "@apollo/client";
import LanguageIcon from '@mui/icons-material/Language'
import { Chip, SxProps, Typography } from "@mui/material";
import { format, addMinutes, differenceInMinutes, isWithinInterval, isSameDay, isToday, isPast, formatDistance, differenceInHours, differenceInSeconds } from 'date-fns'
import { useTranslations } from 'next-intl'; // Import useTranslations to get its return type
// Define the type for the t function
type TFunction = ReturnType<typeof useTranslations>;

export const UPDATE_MEETING_LAST_CALL = gql`
  mutation UpdateMeetingStatus($input: UpdateMeetingStatusInput!) {
    updateMeetingStatus(input: $input) {
      _id
      status
    }
  }
`

export const useMeetingCardUtils = (meetingWithPeer: MeetingWithPeer, textColor: string, now: Date, t: TFunction) => {
  const meeting = meetingWithPeer.meeting
  const { currentUser } = useStore()

  const formatTimeSlot = (startTimestamp: number, endTimestamp: number) => {
    const startDate = new Date(startTimestamp)
    const endDate = new Date(endTimestamp)
    
    // Check if this is a partial slot (close to current time)
    const isCurrentSlot = isWithinInterval(now, { start: startDate, end: endDate })
    
    // Format the start time - show "NOW" if it's the current slot
    const startTime = isCurrentSlot ? t('now') : format(startDate, 'HH:mm')    
    return `${startTime}-${format(endDate, 'HH:mm')}`
  }

  // Format date for display, showing "Today" if it's today
  const formatDateForDisplay = (date: Date) => {
    if (isToday(date)) {
      return `${t('today')} ${format(date, 'HH:mm')}`
    }
    return format(date, 'MMM d, HH:mm')
  }

  // Get the day of the first time slot for passed meetings without a peer
  const getFirstSlotDay = () => {
    if (meeting.timeSlots.length === 0) return '';
    
    // Sort time slots chronologically
    const sortedSlots = [...meeting.timeSlots].sort((a, b) => a - b);
    const firstSlotDate = new Date(sortedSlots[0]);
    
    // Format the date to show the day
    if (isToday(firstSlotDate)) {
      return t('today');
    }
    return format(firstSlotDate, 'MMM d');
  }

  // Group time slots by day
  const groupTimeSlotsByDay = () => {
    const groups: Record<string, number[]> = {}
    
    // Sort time slots chronologically
    const sortedSlots = [...meeting.timeSlots].sort((a, b) => a - b)
    
    sortedSlots.forEach(timestamp => {
      const date = new Date(timestamp)
      
      // Skip slots that are in the past (end time is before now)
      const endTime = new Date(timestamp + 30 * 60 * 1000) // 30 minutes after start
      if (endTime < now) return
      
      // Use "Today" for today's date
      const dayKey = isToday(date) ? t('today') : format(date, 'EEE dd MMM')
      
      if (!groups[dayKey]) groups[dayKey] = []
      groups[dayKey].push(timestamp)
    })
  
    return groups
  }

 
  const getPartnerIcon = () => {
    if (meeting.peerMeetingId) {
      if (currentUser?.sex === meetingWithPeer.peerUser?.sex) {
        return currentUser?.sex === 'male' ? '👬' : '👭'
      } else {
        return '👫'
      }
    }
    return null
  }

  function MeetingLanguagesChips({ meetingColor, chipSx }: { meetingColor: string, chipSx: SxProps }) {
    const languagesToShow = getSharedLanguages(meeting, meetingWithPeer.peerMeeting)

    if ( !languagesToShow || languagesToShow.length === 0 ) return null

    return (
      <div className="flex items-center gap-2">
        <LanguageIcon className={meetingColor} fontSize="small" />
        <div className="flex flex-wrap gap-1">
          {languagesToShow.map(langCode => {
            const language = LANGUAGES.find(l => l.code === langCode)
            return (
              <Chip
                key={langCode}
                label={language?.name || langCode}
                size="small"
                className="text-xs"
                sx={chipSx}
              />
            )
          })}
        </div>
      </div>
    )
  }

  function GenderChip() {
    return <Typography variant="body2" className={textColor}>
              {meeting.allowedMales && meeting.allowedFemales 
                ? t('anyGender') 
                : meeting.allowedMales 
                  ? t('malesOnly') 
                  : t('femalesOnly')}
            </Typography>
  }


  return {
    formatTimeSlot,
    formatDateForDisplay,
    getFirstSlotDay,
    groupTimeSlotsByDay,
    MeetingLanguagesChips,
    GenderChip,
    getPartnerIcon
  }
}