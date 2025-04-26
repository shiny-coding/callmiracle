import { IconButton } from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import HistoryIcon from '@mui/icons-material/History'
import PeopleIcon from '@mui/icons-material/People'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useState } from 'react'
import CallHistoryPopup from './CallHistoryPopup'
import UsersPopup from './UsersPopup'


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

  return (
    <>
      <div className="mt-auto p-3 w-full flex justify-between items-center gap-4 bg-gradient-to-b from-transparent to-white/30">
        {connectionStatus !== 'connected' && (
          <div className="flex gap-2 items-center">
            <IconButton onClick={() => setUsersPopupOpen(true)}>
              <PeopleIcon />
            </IconButton>
            <IconButton onClick={() => setCallHistoryOpen(true)}>
              <HistoryIcon />
            </IconButton>
          </div>
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