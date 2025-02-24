import { Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import UserCard from './UserCard'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

interface MeetingProps {
  meeting: {
    userId: string
    statuses: string[]
    timeSlots: number[]
    minDuration: number
    preferEarlier: boolean
    user: {
      userId: string
      name: string
      hasImage: boolean
      online: boolean
    }
  }
}

export default function MeetingCard({ meeting }: MeetingProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')

  const formatTimeSlot = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString(undefined, { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-2">
      {/* <UserCard 
        user={meeting.user}
        showDetails={false}
        showCallButton={true}
      /> */}
      <div className="flex flex-wrap gap-2 mt-2">
        {meeting.statuses.map(status => (
          <Chip
            key={status}
            label={tStatus(status)}
            size="small"
            className="text-xs text-white bg-gray-700"
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <AccessTimeIcon className="text-gray-400" fontSize="small" />
        <Typography variant="body2" className="text-gray-300">
          {meeting.minDuration} min
        </Typography>
        {meeting.preferEarlier && (
          <TrendingUpIcon className="text-gray-400" fontSize="small" titleAccess={t('preferEarlier')} />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {meeting.timeSlots.map(slot => (
          <Chip
            key={slot}
            label={formatTimeSlot(slot)}
            size="small"
            className="text-xs text-white bg-gray-700"
          />
        ))}
      </div>
    </div>
  )
} 