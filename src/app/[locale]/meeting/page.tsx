'use client';

import { useMeetings } from '@/contexts/MeetingsContext'
import { useTranslations } from 'next-intl'
import MeetingForm from '@/components/MeetingForm'

export default function NewMeetingPage() {
  const t = useTranslations()
  const { meetings, loading, error } = useMeetings()

  if (loading) return <div>{t('loading')}</div>
  if (error) return <div>{t('errorLoadingMeeting')}</div>

  return (
    <MeetingForm
      meetings={meetings}
      meeting={null}
    />
  )
}