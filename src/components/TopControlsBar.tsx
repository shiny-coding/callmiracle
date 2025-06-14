import { IconButton, Badge, Avatar, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import NotificationsIcon from '@mui/icons-material/Notifications'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import { useState, useRef, useEffect, MutableRefObject } from 'react'
import NotificationsPopup from './NotificationsPopup'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useStore } from '@/store/useStore'
import VideoDeviceSelector from './VideoDeviceSelector'
import AudioDeviceSelector from './AudioDeviceSelector'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import LocalVideo from './LocalVideo'
import { useCheckImage } from '@/hooks/useCheckImage'
import { useRouter } from 'next/navigation'
import LocaleSelector from './LocaleSelector'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'

export default function TopControlsBar() {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null)
  const { hasUnseenNotifications } = useNotifications()
  const { currentUser, localAudioEnabled, localVideoEnabled, setLocalAudioEnabled, setLocalVideoEnabled } = useStore((state: any) => ({ currentUser: state.currentUser, localAudioEnabled: state.localAudioEnabled, localVideoEnabled: state.localVideoEnabled, setLocalAudioEnabled: state.setLocalAudioEnabled, setLocalVideoEnabled: state.setLocalVideoEnabled }))
  const [isHoveringOverVideoControls, setIsHoveringOverVideoControls] = useState(false)
  const [isVideoDeviceSelectorOpen, setIsVideoDeviceSelectorOpen] = useState(false)
  const [videoOpenedByTouch, setVideoOpenedByTouch] = useState(false)
  const { exists: imageExists } = useCheckImage(currentUser?._id)
  const router = useRouter()
  const t = useTranslations('Profile')

  const {
    connectionStatus,
    hangup,
    sendWantedMediaState
  } = useWebRTCContext()

  const barRef = useRef<HTMLDivElement>(null)
  const videoIconButtonRef = useRef<HTMLButtonElement>(null)
  const isTouchOnlyDevice = window.matchMedia('(pointer: coarse) and (hover: none)').matches

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      // Only proceed if event.target is a Node and is in the document
      if (
        !(event.target instanceof Node) ||
        !document.contains(event.target)
      ) {
        return
      }

      if (
        isTouchOnlyDevice &&
        barRef.current &&
        !barRef.current.contains(event.target)
      ) {
        setVideoOpenedByTouch(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [])

  const handleAudioToggle = () => {
    setLocalAudioEnabled(!localAudioEnabled)
    sendWantedMediaState()
  }

  const handleVideoToggle = () => {
    setLocalVideoEnabled(!localVideoEnabled)
    sendWantedMediaState()
    if (isTouchOnlyDevice) {
      setVideoOpenedByTouch(!localVideoEnabled)
    }
  }

  // Handle video device selector open state
  const handleVideoDeviceSelectorOpen = (isOpen: boolean) => {
    setIsVideoDeviceSelectorOpen(isOpen)
    if (isVideoDeviceSelectorOpen && !isOpen && isTouchOnlyDevice) {
      // if closing the video device selector, set isHoveringOverVideoControls to true (needed for touch devices)
      setVideoOpenedByTouch(true)
    }
  }

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null)
  }

  const handleProfileSettings = () => {
    handleProfileMenuClose()
    router.push('/profile')
  }

  const handleLogout = () => {
    handleProfileMenuClose()
    signOut({ callbackUrl: '/auth/signin' })
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
        <Badge color="error" variant="dot" invisible={!hasUnseenNotifications}>
          <NotificationsIcon className="text-white" />
        </Badge>
      </IconButton>

      <div className="flex items-center gap-4 grow justify-center">
        <div className="flex gap-2 items-center">
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
          <AudioDeviceSelector />
        </div>

        <div 
          className="flex gap-2 items-center"
          onMouseEnter={() => {
            if (!isTouchOnlyDevice) {
              setIsHoveringOverVideoControls(true)
            }
          }}
          onMouseLeave={() => {
            if (!isTouchOnlyDevice) {
              setIsHoveringOverVideoControls(false)
            }
          }}
        >
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
            onClick={handleVideoToggle}
            ref={videoIconButtonRef}
          >
            {localVideoEnabled ? (
              <VideocamIcon className="text-white" />
            ) : (
              <VideocamOffIcon className="text-red-400" />
            )}
          </IconButton>
          <div 
            className={
              connectionStatus === 'connected'
              ? 'fixed z-50 right-0 bottom-16 m-0 transition-all duration-300'
              : 'fixed z-50 left-1/2 top-[64px] -translate-x-1/2 transition-all duration-300'
            }
            style={{ visibility: isHoveringOverVideoControls || isVideoDeviceSelectorOpen || videoOpenedByTouch ? 'visible' : 'hidden' }}
          >
            <LocalVideo />
          </div>
          <VideoDeviceSelector
            onOpenChange={handleVideoDeviceSelectorOpen}
          />
        </div>
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