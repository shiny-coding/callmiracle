'use client'

import { useParams, useRouter } from 'next/navigation'
import { useMeetings } from '@/contexts/MeetingsContext'
import { useTranslations } from 'next-intl'
import MeetingForm from '@/components/MeetingForm'

export default function MeetingPage() {
  const { id } = useParams()
  const t = useTranslations()
  const router = useRouter()
  const { meetings, loading, error } = useMeetings()

  if (loading) return <div>{t('loading')}</div>
  if (error) return <div>{t('errorLoadingMeeting')}</div>

  const meetingWithPeer = meetings.find(m => m.meeting._id === id)
  if (!meetingWithPeer) {
    return (
      <div>
        <p>{t('meetingNotFound')}</p>
        <button onClick={() => router.back()}>{t('back')}</button>
      </div>
    )
  }

  return (
    <MeetingForm
      meetings={meetings}
      meeting={meetingWithPeer.meeting}
    />
  )
} 