'use client'

import { useState, useEffect } from 'react'
import { Button, Alert, AlertTitle } from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import { useTranslations } from 'next-intl'

export default function NotificationPermissionButton() {
  const t = useTranslations()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [showIOSInfo, setShowIOSInfo] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Notification) {
      setPermission(Notification.permission)

      // Detect iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone

      if (isIOS && !isInStandaloneMode) {
        setShowIOSInfo(true)
      }
    }
  }, [])

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !window.Notification) {
      alert(t('notificationsNotSupported'))
      return
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === 'granted') {
        // Test notification
        new Notification('CallMiracle', {
          body: t('notificationsEnabled'),
          icon: '/icon-192x192.png'
        })
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error)
    }
  }

  if (typeof window === 'undefined' || !window.Notification) {
    return null
  }

  return (
    <div className="space-y-2">
      {showIOSInfo && (
        <Alert severity="info" className="mb-2">
          <AlertTitle>{t('iOSNotificationInfo')}</AlertTitle>
          {t('iOSNotificationInfoDescription')}
        </Alert>
      )}

      {permission === 'default' && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<NotificationsIcon />}
          onClick={requestPermission}
          fullWidth
        >
          {t('enableNotifications')}
        </Button>
      )}

      {permission === 'granted' && (
        <Alert severity="success">
          <NotificationsIcon className="mr-2" />
          {t('notificationsGranted')}
        </Alert>
      )}

      {permission === 'denied' && (
        <Alert severity="error">
          <NotificationsOffIcon className="mr-2" />
          {t('notificationsDenied')}
        </Alert>
      )}
    </div>
  )
}
