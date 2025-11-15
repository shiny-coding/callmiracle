'use client'

import { IconButton, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import RefreshIcon from '@mui/icons-material/Refresh'
import BugReportIcon from '@mui/icons-material/BugReport'
import LanguageIcon from '@mui/icons-material/Language'
import { useState } from 'react'
import NotificationBadge from './NotificationBadge'
import NotificationsPopup from './NotificationsPopup'
import LanguageDialog from './LanguageDialog'
import LogViewerDialog from './LogViewerDialog'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { routerPush } from '@/utils/routerHelper'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useStore } from '@/store/useStore'
import { useProfileImage } from '@/hooks/useProfileImage'

interface MediaControlsProps {
  showNotifications?: boolean
  showMediaButtons?: boolean
  showProfile?: boolean
  className?: string
}

export default function MediaControls({
  showNotifications = true,
  showMediaButtons = true,
  showProfile = true,
  className = ''
}: MediaControlsProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false)

  const { hasUnseenNotifications } = useNotifications()
  const { connectionStatus, sendWantedMediaState } = useWebRTCContext()
  const { currentUser, localAudioEnabled, localVideoEnabled, setLocalAudioEnabled, setLocalVideoEnabled, setDeviceSettingsOpen } = useStore((state: any) => ({
    currentUser: state.currentUser,
    localAudioEnabled: state.localAudioEnabled,
    localVideoEnabled: state.localVideoEnabled,
    setLocalAudioEnabled: state.setLocalAudioEnabled,
    setLocalVideoEnabled: state.setLocalVideoEnabled,
    setDeviceSettingsOpen: state.setDeviceSettingsOpen
  }))
  const { imageSrc } = useProfileImage(currentUser?._id, currentUser?.updatedAt)
  const router = useRouter()
  const t = useTranslations('Profile')
  const tRoot = useTranslations()

  const handleAudioToggle = () => {
    setLocalAudioEnabled(!localAudioEnabled)
    sendWantedMediaState()
  }

  const handleVideoToggle = () => {
    setLocalVideoEnabled(!localVideoEnabled)
    sendWantedMediaState()
  }

  const handleProfileMenuToggle = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(profileMenuAnchor ? null : event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null)
  }

  const handleProfileSettings = () => {
    handleProfileMenuClose()
    routerPush(router, '/profile', {
      source: 'media_controls_profile_menu',
      connectionStatus
    })
  }

  const handleDeviceSettings = () => {
    setDeviceSettingsOpen(true)
  }

  const handleLogout = () => {
    handleProfileMenuClose()
    signOut({ redirect: false }).then(() => {
      routerPush(router, '/auth/signin', {
        source: 'media_controls_logout',
        previousConnectionStatus: connectionStatus
      })
    })
  }

  const handleRefresh = () => {
    handleProfileMenuClose()
    window.location.reload()
  }

  const handleViewLogs = () => {
    handleProfileMenuClose()
    setLogViewerOpen(true)
  }

  const handleLanguageClick = () => {
    handleProfileMenuClose()
    setLanguageDialogOpen(true)
  }

  return (
    <>
      <div className={`flex items-center gap-4 ${className}`}>
        {showNotifications && (
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
            onClick={() => setNotificationsOpen(true)}
          >
            <NotificationBadge show={hasUnseenNotifications}>
              <NotificationsIcon className="text-white" />
            </NotificationBadge>
          </IconButton>
        )}

        {showMediaButtons && (
          <>
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
          </>
        )}

        {showProfile && (
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40 p-0"
            onClick={handleProfileMenuToggle}
            style={{ width: 40, height: 40 }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(4px)',
                color: 'white',
                fontWeight: 'bold'
              }}
              src={imageSrc}
            >
              {currentUser?.name?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
        )}
      </div>

      {/* Profile Menu */}
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
        <MenuItem onClick={handleLanguageClick}>
          <ListItemIcon>
            <LanguageIcon sx={{ color: 'white' }} />
          </ListItemIcon>
          <ListItemText primary={tRoot('selectInterfaceLanguage')} />
        </MenuItem>
        <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
        <MenuItem onClick={handleRefresh}>
          <ListItemIcon>
            <RefreshIcon sx={{ color: 'white' }} />
          </ListItemIcon>
          <ListItemText primary={tRoot('Profile.refreshPage')} />
        </MenuItem>
        <MenuItem onClick={handleViewLogs}>
          <ListItemIcon>
            <BugReportIcon sx={{ color: 'white' }} />
          </ListItemIcon>
          <ListItemText primary={tRoot('Profile.viewClientLogs')} />
        </MenuItem>
        <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon sx={{ color: 'white' }} />
          </ListItemIcon>
          <ListItemText primary={t('logout')} />
        </MenuItem>
      </Menu>

      {/* Notifications Popup */}
      <NotificationsPopup
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      {/* Log Viewer Dialog */}
      <LogViewerDialog
        open={logViewerOpen}
        onClose={() => setLogViewerOpen(false)}
      />

      {/* Language Dialog */}
      <LanguageDialog
        open={languageDialogOpen}
        onClose={() => setLanguageDialogOpen(false)}
      />
    </>
  )
}
