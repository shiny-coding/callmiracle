'use client'

import { useState } from 'react'
import { Typography, Container, Alert, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function NotificationPermissionRequestScreen() {
  const t = useTranslations()
  const router = useRouter()
  const [isRequesting, setIsRequesting] = useState(false)

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !window.Notification) {
      return
    }

    setIsRequesting(true)

    try {
      const result = await window.Notification.requestPermission()

      if (result === 'granted') {
        // Permission granted, reload to show normal app
        window.location.reload()
      } else if (result === 'denied') {
        // Permission denied, reload to show denied screen
        window.location.reload()
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      setIsRequesting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black text-white overflow-auto z-50">
      <Container maxWidth="sm" className="py-8 px-4">
        {/* App Icon and Name */}
        <div className="flex justify-center mb-8">
          <div className="relative inline-flex items-center">
            <div className="absolute right-full mr-3 w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
              <Image
                src="/logo-192.png"
                alt="CallMiracle"
                width={64}
                height={64}
                className="w-full h-full"
                unoptimized
              />
            </div>
            <Typography variant="h4" className="font-bold">
              CallMiracle
            </Typography>
          </div>
        </div>

        {/* Main Message */}
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            <NotificationsActiveIcon className="text-blue-400 text-5xl" />
          </div>

          <Alert severity="info" className="mb-6">
            <Typography variant="body1" className="font-semibold">
              {t('notificationPermissionRequired')}
            </Typography>
          </Alert>

          <Typography variant="body1" className="text-gray-300 text-center mb-8">
            {t('notificationPermissionRequiredDescription')}
          </Typography>

          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <Typography variant="subtitle1" className="font-semibold text-center">
              {t('whenDialogAppears')}
            </Typography>
            <Typography variant="body2" className="text-gray-300 text-center">
              {t('clickAllowInDialog')}
            </Typography>
          </div>

          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="mt-8"
          >
            {isRequesting ? t('requesting') : t('next')}
          </Button>

          <div className="mt-8 p-4 bg-blue-900/30 rounded-lg border border-blue-500">
            <Typography variant="body2" className="text-blue-200 text-center">
              {t('notificationPermissionNote')}
            </Typography>
          </div>
        </div>
      </Container>
    </div>
  )
}
