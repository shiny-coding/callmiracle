import { IconButton, Badge } from '@mui/material'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import NotificationsIcon from '@mui/icons-material/Notifications'
import ProfileDialog from './ProfileDialog'
import { useState } from 'react'
import NotificationsPopup from './NotificationsPopup'
import { useNotifications } from '@/contexts/NotificationsContext'

export default function TopControlsBar() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { hasUnseenNotifications } = useNotifications()

  return (
    <div className="p-4 w-full flex justify-between items-center gap-4 bg-gradient-to-t from-transparent to-white/30">
      <IconButton
        className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
        onClick={() => setNotificationsOpen(true)}
      >
        <Badge color="error" variant="dot" invisible={!hasUnseenNotifications}>
          <NotificationsIcon className="text-white" />
        </Badge>
      </IconButton>
      <IconButton
        className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
        onClick={() => setProfileOpen(true)}
      >
        <AccountCircleIcon className="text-white" />
      </IconButton>
      <ProfileDialog 
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <NotificationsPopup
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  )
} 