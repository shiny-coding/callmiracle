import { IconButton } from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import HistoryIcon from '@mui/icons-material/History'
import PersonIcon from '@mui/icons-material/Person'
import GroupIcon from '@mui/icons-material/Group'
import ListIcon from '@mui/icons-material/List'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import MessageIcon from '@mui/icons-material/Message'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useRouter, usePathname  } from 'next/navigation'
import { useLocale } from 'next-intl';

let mousePosition = { x: 0, y: 0 }

document.addEventListener("mousemove", function (event) {
  mousePosition = { x: event.clientX, y: event.clientY }
});

export default function BottomControlsBar() {
  
  const {
    connectionStatus,
    hangup,
  } = useWebRTCContext()

  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const listPath = `/${locale}/list`
  const calendarPath = `/${locale}/calendar`
  const usersPath = `/${locale}/users`
  const groupsPath = `/${locale}/groups`
  const conversationsPath = `/${locale}/conversations`
  const callHistoryPath = `/${locale}/call-history`

  const selectedColor = '#60a5fa'

  return (
    <>
      <div className="mt-auto p-3 w-full flex justify-center items-center gap-4 bg-gradient-to-b from-transparent to-white/30">
        {connectionStatus !== 'connected' && (
          <>
            <IconButton onClick={() => router.push(calendarPath)} style={{ color: pathname === calendarPath ? selectedColor : undefined, }} >
              <CalendarMonthIcon />
            </IconButton>
            <IconButton onClick={() => router.push(listPath)} style={{ color: pathname === listPath ? selectedColor : undefined, }} >
              <ListIcon />
            </IconButton>

            <IconButton onClick={() => router.push(usersPath)} style={{ color: pathname === usersPath ? selectedColor : undefined, }} >
              <PersonIcon />
            </IconButton>
            
            <IconButton onClick={() => router.push(groupsPath)} style={{ color: pathname === groupsPath ? selectedColor : undefined, }} >
              <GroupIcon />
            </IconButton>
            
            <IconButton onClick={() => router.push(conversationsPath)} style={{ color: pathname === conversationsPath ? selectedColor : undefined, }} >
              <MessageIcon />
            </IconButton>
            
            <IconButton onClick={() => router.push(callHistoryPath)} style={{ color: pathname === callHistoryPath ? selectedColor : undefined, }} >
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
      </div>
    </>
  )
} 