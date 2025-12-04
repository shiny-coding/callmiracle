'use client'

import { IconButton, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Divider, ListSubheader } from '@mui/material'
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
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import { useState } from 'react'
import NotificationBadge from './NotificationBadge'
import LanguageDialog from './LanguageDialog'
import LogViewerDialog from './LogViewerDialog'
import { signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { routerPush } from '@/utils/routerHelper'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useStore } from '@/store/useStore'
import { useProfileImage } from '@/hooks/useProfileImage'
import { triggerMenuException, triggerMenuPromiseRejection, triggerComplexException } from '@/utils/errorTestTriggers'

// Set to true to show error testing menu items (for development/debugging)
const SHOW_ERROR_TESTING_MENU = false

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
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('Profile')
  const tRoot = useTranslations()

  const notificationsPath = `/${locale}/notifications`
  const selectedColor = '#60a5fa'

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

  const handleRefresh = async () => {
    handleProfileMenuClose()

    // Force service worker update and hard refresh
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()

        // Update all service worker registrations
        const updatePromises = registrations.map(async (registration) => {
          await registration.update()

          // Unregister the service worker to ensure fresh reload
          await registration.unregister()
        })

        await Promise.all(updatePromises)

        console.log('Service workers unregistered for hard refresh')
      } catch (error) {
        console.error('Failed to unregister service workers', { error })
      }
    }

    // Clear all caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
        console.log('All caches cleared')
      } catch (error) {
        console.error('Failed to clear caches', { error })
      }
    }

    // Hard reload the page
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

  const handleTriggerException = () => {
    handleProfileMenuClose()
    // Trigger multi-file call stack error for testing
    triggerMenuException()
  }

  const handleTriggerPromiseRejection = () => {
    handleProfileMenuClose()
    // Trigger promise rejection error for testing
    triggerMenuPromiseRejection()
  }

  const handleTriggerComplexException = () => {
    handleProfileMenuClose()
    // Trigger error with complex metadata for testing
    triggerComplexException()
  }

  const handleTriggerLogs = () => {
    handleProfileMenuClose()

    console.log('Debug log test', {
      testType: 'menu_trigger'
    })

    console.log('Info log test', {
      testType: 'menu_trigger',
      userAction: 'test_logging'
    })

    console.warn('Warning log test', {
      testType: 'menu_trigger',
      warningReason: 'This is a test warning'
    })
  }

  return (
    <>
      <div className={`flex items-center gap-4 ${className}`}>
        {showNotifications && (
          <IconButton
            onClick={() => routerPush(router, '/notifications', {
              source: 'media_controls_notifications'
            })}
            className={pathname === notificationsPath ? 'icon-gradient-active' : 'icon-gradient'}
          >
            <NotificationBadge show={hasUnseenNotifications}>
              <NotificationsIcon />
            </NotificationBadge>
          </IconButton>
        )}

        {showMediaButtons && (
          <>
            <IconButton
              onClick={handleAudioToggle}
              className="icon-gradient-blue"
            >
              {localAudioEnabled ? (
                <MicIcon />
              ) : (
                <MicOffIcon />
              )}
            </IconButton>

            <IconButton
              onClick={handleVideoToggle}
              className="icon-gradient-blue"
            >
              {localVideoEnabled ? (
                <VideocamIcon />
              ) : (
                <VideocamOffIcon />
              )}
            </IconButton>

            <IconButton
              onClick={handleDeviceSettings}
              title="Device Settings"
              className="icon-gradient-blue"
            >
              <SettingsIcon />
            </IconButton>
          </>
        )}

        {showProfile && (
          <IconButton
            className="p-0"
            onClick={handleProfileMenuToggle}
            style={{ width: 40, height: 40 }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'transparent',
                color: 'var(--dimmer-text-color)',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                border: '1px solid orange'
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
            mt: '6px',
            ml: '8px',
          },
        }}
        marginThreshold={0}
      >
        <ListSubheader
          sx={{
            bgcolor: 'transparent',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            textTransform: 'capitalize',
            userSelect: 'none',
            lineHeight: '2.5'
          }}
        >
          {currentUser?.name}
        </ListSubheader>
        <Divider />
        <MenuItem onClick={handleProfileSettings}>
          <ListItemIcon className="icon-gradient">
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary={t('title')} />
        </MenuItem>
        <MenuItem onClick={handleLanguageClick}>
          <ListItemIcon className="icon-gradient">
            <LanguageIcon />
          </ListItemIcon>
          <ListItemText primary={tRoot('selectInterfaceLanguage')} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleRefresh}>
          <ListItemIcon className="icon-gradient">
            <RefreshIcon />
          </ListItemIcon>
          <ListItemText primary={tRoot('Profile.refreshPage')} />
        </MenuItem>
        <MenuItem onClick={handleViewLogs}>
          <ListItemIcon className="icon-gradient">
            <BugReportIcon />
          </ListItemIcon>
          <ListItemText primary={tRoot('Profile.viewClientLogs')} />
        </MenuItem>
        {SHOW_ERROR_TESTING_MENU && (
          <>
            <Divider />
            <ListSubheader sx={{ bgcolor: 'transparent', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>
              {tRoot('Profile.logTestingTools')}
            </ListSubheader>
            <MenuItem onClick={handleTriggerLogs}>
              <ListItemIcon className="icon-gradient">
                <InfoIcon />
              </ListItemIcon>
              <ListItemText
                primary={tRoot('Profile.triggerLogs')}
                secondary={tRoot('Profile.triggerLogsDesc')}
                secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem' } }}
              />
            </MenuItem>
            <Divider />
            <ListSubheader sx={{ bgcolor: 'transparent', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>
              {tRoot('Profile.errorTestingTools')}
            </ListSubheader>
            <MenuItem onClick={handleTriggerException}>
              <ListItemIcon className="icon-gradient">
                <ErrorIcon />
              </ListItemIcon>
              <ListItemText
                primary={tRoot('Profile.throwError')}
                secondary={tRoot('Profile.throwErrorDesc')}
                secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem' } }}
              />
            </MenuItem>
            <MenuItem onClick={handleTriggerPromiseRejection}>
              <ListItemIcon className="icon-gradient">
                <ErrorIcon />
              </ListItemIcon>
              <ListItemText
                primary={tRoot('Profile.rejectPromise')}
                secondary={tRoot('Profile.rejectPromiseDesc')}
                secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem' } }}
              />
            </MenuItem>
            <MenuItem onClick={handleTriggerComplexException}>
              <ListItemIcon className="icon-gradient">
                <ErrorIcon />
              </ListItemIcon>
              <ListItemText
                primary={tRoot('Profile.complexError')}
                secondary={tRoot('Profile.complexErrorDesc')}
                secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem' } }}
              />
            </MenuItem>
          </>
        )}
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon className="icon-gradient">
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary={t('logout')} />
        </MenuItem>
      </Menu>

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
