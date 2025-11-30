'use client'

import { useState, useEffect } from 'react'
import { Typography, Container, Alert } from '@mui/material'
import { useTranslations } from 'next-intl'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import Image from 'next/image'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'
type Browser = 'chrome' | 'safari' | 'other'

export default function NotificationPermissionDeniedScreen() {
  const t = useTranslations()
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [browser, setBrowser] = useState<Browser>('other')
  const [fullSizeImage, setFullSizeImage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const userAgent = navigator.userAgent

    // Detect platform
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      setPlatform('ios')
    } else if (/Android/.test(userAgent)) {
      setPlatform('android')
    } else {
      setPlatform('desktop')
    }

    // Detect browser
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/CriOS/.test(userAgent)) {
      setBrowser('safari')
    } else if (/Chrome/.test(userAgent) || /CriOS/.test(userAgent)) {
      setBrowser('chrome')
    } else {
      setBrowser('other')
    }
  }, [])

  // Detect when user returns from settings with permission enabled
  useEffect(() => {
    if (typeof window === 'undefined' || !window.Notification) return

    const checkPermissionOnVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if permission was granted in settings
        if (window.Notification.permission === 'granted') {
          console.log('Notification permission granted in settings, reloading app')
          window.location.reload()
        }
      }
    }

    // Check when page becomes visible (user returns from settings)
    document.addEventListener('visibilitychange', checkPermissionOnVisibilityChange)

    // Also check on focus (alternative detection)
    window.addEventListener('focus', () => {
      if (window.Notification.permission === 'granted') {
        console.log('Notification permission granted in settings, reloading app')
        window.location.reload()
      }
    })

    return () => {
      document.removeEventListener('visibilitychange', checkPermissionOnVisibilityChange)
    }
  }, [])

  return (
    <>
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
              <NotificationsOffIcon className="text-red-400 text-4xl" />
            </div>

            <Alert severity="warning" className="mb-6">
              <Typography variant="body1" className="font-semibold">
                {t('notificationPermissionDenied')}
              </Typography>
            </Alert>

            <Typography variant="body1" className="text-gray-300 text-center mb-8">
              {t('notificationPermissionDeniedDescription')}
            </Typography>

            {/* Reinstall suggestion */}
            <div className="space-y-6">
              <div className=" p-6 rounded-lg space-y-4">
                <Typography variant="h6" className="font-semibold text-center text-orange-400">
                  {t('recommendedSolution')}
                </Typography>
                <Typography variant="body1" className="text-gray-300 text-center">
                  {t('reinstallAppSuggestion')}
                </Typography>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <Typography variant="subtitle2" className="font-semibold mb-2">
                    {t('howToReinstall')}
                  </Typography>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    <li>{t('reinstallStep1')}</li>
                    <li>{t('reinstallStep2')}</li>
                    <li>{t('reinstallStep3')}</li>
                  </ol>
                </div>
              </div>

              <div className=" p-4 rounded-lg">
                <Typography variant="subtitle2" className="font-semibold mb-2">
                  {t('alternativeMethod')}
                </Typography>
                <Typography variant="body2" className="text-gray-400 text-sm">
                  {t('goToSettingsAlternative')}
                </Typography>
              </div>
            </div>

            <div className="mt-8 p-4 bg-orange-900/30 rounded-lg border border-orange-500">
              <Typography variant="body2" className="text-orange-200 text-center">
                {t('notificationDeniedNote')}
              </Typography>
            </div>
          </div>
        </Container>
      </div>

      {/* Full-size Image Viewer */}
      <Dialog
        open={!!fullSizeImage}
        onClose={() => setFullSizeImage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent className="relative p-0 bg-black">
          <IconButton
            onClick={() => setFullSizeImage(null)}
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70"
            size="small"
          >
            <CloseIcon className="text-white" />
          </IconButton>
          {fullSizeImage && (
            <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
              <Image
                src={fullSizeImage}
                alt="Full size instruction"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
