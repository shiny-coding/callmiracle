import { IconButton } from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import HistoryIcon from '@mui/icons-material/History'
import PeopleIcon from '@mui/icons-material/People'
import ListIcon from '@mui/icons-material/List'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useState } from 'react'
import CallHistoryPopup from './CallHistoryPopup'
import UsersPopup from './UsersPopup'
import { useRouter, usePathname  } from 'next/navigation'
import { useLocale } from 'next-intl';

let mousePosition = { x: 0, y: 0 }

document.addEventListener("mousemove", function (event) {
  mousePosition = { x: event.clientX, y: event.clientY }
});

export default function BottomControlsBar() {
  const [callHistoryOpen, setCallHistoryOpen] = useState(false)
  const [usersPopupOpen, setUsersPopupOpen] = useState(false)
  
  const {
    connectionStatus,
    hangup,
  } = useWebRTCContext()

  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const listPath = `/${locale}/list`
  const calendarPath = `/${locale}/calendar`

  return (
    <>
      <div className="mt-auto p-3 w-full flex justify-center items-center gap-4 bg-gradient-to-b from-transparent to-white/30">
        <IconButton
          onClick={() => router.push(listPath)}
          style={{
            color: pathname === listPath ? '#60a5fa' : undefined,
          }}
        >
          <ListIcon />
        </IconButton>
        <IconButton
          onClick={() => router.push(calendarPath)}
          style={{
            color: pathname === calendarPath ? '#60a5fa' : undefined,
          }}
        >
          <CalendarMonthIcon />
        </IconButton>
        {connectionStatus !== 'connected' && (
          <>
            <IconButton onClick={() => setUsersPopupOpen(true)}>
              <PeopleIcon />
            </IconButton>
            <IconButton onClick={() => setCallHistoryOpen(true)}>
              <HistoryIcon />
            </IconButton>
          </>
        )}
        {connectionStatus === 'connected' && (
          <div>
            <IconButton
              className="bg-red-600 hover:bg-red-700 text-white" 
              onClick={hangup}
            >
              <CallEndIcon className="text-red-400" />
            </IconButton>
          </div>
        )}

        {connectionStatus !== 'connected' && (
          <>
            <CallHistoryPopup
              open={callHistoryOpen}
              onClose={() => setCallHistoryOpen(false)}
            />
            <UsersPopup
              open={usersPopupOpen}
              onClose={() => setUsersPopupOpen(false)}
            />
          </>
        )}
      </div>
    </>
  )
} 