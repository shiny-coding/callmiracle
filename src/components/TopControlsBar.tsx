'use client'

import { IconButton, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import { useState, useRef } from 'react'
import NotificationsPopup from './NotificationsPopup'
import NotificationBadge from './NotificationBadge'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useStore } from '@/store/useStore'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import { useCheckImage } from '@/hooks/useCheckImage'
import { useRouter } from 'next/navigation'
import LocaleSelector from './LocaleSelector'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { routerPush } from '@/utils/routerHelper'

export default function TopControlsBar() {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null)
  const { hasUnseenNotifications } = useNotifications()
  const { currentUser, localAudioEnabled, localVideoEnabled, setLocalAudioEnabled, setLocalVideoEnabled } = useStore((state: any) => ({ currentUser: state.currentUser, localAudioEnabled: state.localAudioEnabled, localVideoEnabled: state.localVideoEnabled, setLocalAudioEnabled: state.setLocalAudioEnabled, setLocalVideoEnabled: state.setLocalVideoEnabled }))
  const { exists: imageExists } = useCheckImage(currentUser?._id, currentUser?.updatedAt)
  const router = useRouter()
  const t = useTranslations('Profile')

  const {
    connectionStatus,
    hangup,
    sendWantedMediaState
  } = useWebRTCContext()

  const barRef = useRef<HTMLDivElement>(null)

  const handleAudioToggle = () => {
    setLocalAudioEnabled(!localAudioEnabled)
    sendWantedMediaState()
  }

  const handleVideoToggle = () => {
    setLocalVideoEnabled(!localVideoEnabled)
    sendWantedMediaState()
  }

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null)
  }

  const handleProfileSettings = () => {
    handleProfileMenuClose()
    routerPush(router, '/profile', {
      source: 'top_controls_bar_profile_menu',
      connectionStatus
    })
  }

  const handleDeviceSettings = () => {
    routerPush(router, '/settings', {
      source: 'top_controls_bar_device_settings',
      connectionStatus
    })
  }

  const handleLogout = () => {
    handleProfileMenuClose()
    signOut({ redirect: false }).then(() => {
      routerPush(router, '/auth/signin', {
        source: 'top_controls_bar_logout',
        previousConnectionStatus: connectionStatus
      })
    })
  }

  return (
    <div
      ref={barRef}
      className="p-3 w-full flex justify-between items-center gap-4 bg-gradient-to-t from-transparent to-white/30"
    >
      <IconButton
        className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
        onClick={() => setNotificationsOpen(true)}
      >
        <NotificationBadge show={hasUnseenNotifications}>
          <NotificationsIcon className="text-white" />
        </NotificationBadge>
      </IconButton>

      <div className="flex items-center gap-4 grow justify-center">
        <IconButton
          className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
          onClick={handleAudioToggle}
        >
          {localAudioEnabled ? (
            <MicIcon className="text-white" />
          ) : (
            <MicOffIcon className="text-red-400" />
          )}
        </IconButton>

        <IconButton
          className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
          onClick={handleVideoToggle}
        >
          {localVideoEnabled ? (
            <VideocamIcon className="text-white" />
          ) : (
            <VideocamOffIcon className="text-red-400" />
          )}
        </IconButton>

        <IconButton
          className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
          onClick={handleDeviceSettings}
          title="Device Settings"
        >
          <SettingsIcon className="text-white" />
        </IconButton>
      </div>

      <div className="flex gap-3 items-center overflow-hidden">
        <div className="text-sm text-white/80 capitalize overflow-hidden text-ellipsis whitespace-nowrap">
          {currentUser?.name}
        </div>
        <div className="relative w-10 h-10">
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40 p-0"
            onClick={handleProfileMenuOpen}
            style={{ width: 40, height: 40 }}
          >
            <Avatar
              sx={{ width: 40, height: 40, position: 'absolute', top: 0, left: 0 }}
              src={imageExists ? `/profiles/${currentUser?._id}.jpg?v=${currentUser?.updatedAt}` : undefined}
            >
              {!imageExists && currentUser?.name?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
        </div>
      </div>

      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            bgcolor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            '& .MuiMenuItem-root': {
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            },
          },
        }}
      >
        <MenuItem onClick={handleProfileSettings}>
          <ListItemIcon>
            <SettingsIcon sx={{ color: 'white' }} />
          </ListItemIcon>
          <ListItemText primary={t('title')} />
        </MenuItem>
        <MenuItem>
          <LocaleSelector />
        </MenuItem>
        <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon sx={{ color: 'white' }} />
          </ListItemIcon>
          <ListItemText primary={t('logout')} />
        </MenuItem>
      </Menu>

      <NotificationsPopup
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  )
} 