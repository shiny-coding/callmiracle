'use client';

import MeetingsCalendar from '@/components/MeetingsCalendar';
import DeferredRender from '@/components/DeferredRender';

export default function CalendarPage() {
  return (
    <DeferredRender>
      <MeetingsCalendar />
    </DeferredRender>
  )
}