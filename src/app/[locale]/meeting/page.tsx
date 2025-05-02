'use client';

import { useMeetings } from '@/contexts/MeetingsContext'
import { useTranslations } from 'next-intl'
import MeetingDialog from '@/components/MeetingDialog'

export default function NewMeetingPage() {
  const t = useTranslations()
  const { meetings, loading, error } = useMeetings()

  if (loading) return <div>{t('loading')}</div>
  if (error) return <div>{t('errorLoadingMeeting')}</div>

  return (
    <MeetingDialog
      meetings={meetings}
      meeting={null}
    />
  )
}