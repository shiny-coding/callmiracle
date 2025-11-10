'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert } from '@mui/material'
import { useTranslations } from 'next-intl'
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen'
import CloseIcon from '@mui/icons-material/Close'
import { useStore } from '@/store/useStore'
import Image from 'next/image'
import IconButton from '@mui/material/IconButton'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

interface AddToHomeScreenState {
  lastShown: number | null
  timesShown: number
  dismissed: boolean
}

export default function AddToHomeScreenDialog() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false)
  const [fullSizeImage, setFullSizeImage] = useState<string | null>(null)
  const { currentUser } = useStore((state) => ({ currentUser: state.currentUser }))

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)

    // Detect if already in standalone mode (PWA)
    const standalone = ('standalone' in window.navigator) && (window.navigator as any).standalone
    setIsInStandaloneMode(standalone)

    // Don't show if not iOS or already in PWA mode
    if (!iOS || standalone) return

    // Check if user has completed first-time setup
    if (!currentUser?.languages || currentUser.languages.length === 0) return

    // Get stored state from localStorage
    const storedState = localStorage.getItem('addToHomeScreenState')
    let state: AddToHomeScreenState = storedState
      ? JSON.parse(storedState)
      : { lastShown: null, timesShown: 0, dismissed: false }

    // Don't show if user dismissed permanently
    if (state.dismissed) return

    // Check if we should show based on timing
    const now = Date.now()
    const shouldShow =
      state.lastShown === null || // Never shown before
      (now - state.lastShown >= ONE_DAY_MS) // At least 1 day passed

    if (shouldShow) {
      // Update state
      state.lastShown = now
      state.timesShown += 1
      localStorage.setItem('addToHomeScreenState', JSON.stringify(state))

      // Show dialog
      setOpen(true)
    }
  }, [currentUser])

  const handleMaybeLater = () => {
    setOpen(false)
  }

  const handleDontRemind = () => {
    const storedState = localStorage.getItem('addToHomeScreenState')
    const state: AddToHomeScreenState = storedState
      ? JSON.parse(storedState)
      : { lastShown: Date.now(), timesShown: 1, dismissed: false }

    state.dismissed = true
    localStorage.setItem('addToHomeScreenState', JSON.stringify(state))
    setOpen(false)
  }

  const handleAddNow = () => {
    // Can't programmatically trigger add to home screen, just close dialog
    setOpen(false)
  }

  // Get current times shown
  const storedState = localStorage.getItem('addToHomeScreenState')
  const timesShown = storedState ? JSON.parse(storedState).timesShown : 1

  if (!isIOS || isInStandaloneMode) return null

  return (
    <>
      <Dialog
        open={open}
        onClose={handleMaybeLater}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '85vh',
            margin: '7.5vh auto'
          }
        }}
      >
        <DialogTitle className="flex items-center gap-2">
          <AddToHomeScreenIcon />
          {t('addToHomeScreenTitle')}
        </DialogTitle>
        <DialogContent>
          <div className="space-y-3">
            <Typography variant="body1">
              {t('addToHomeScreenDescription')}
            </Typography>

            <Alert severity="info">
              <Typography variant="body2">
                {t('iOSNotificationRequirement')}
              </Typography>
            </Alert>

            <div className="bg-gray-800 p-4 rounded-lg space-y-2">
              <Typography variant="subtitle2" className="font-semibold">
                {t('howToAddToHomeScreen')}
              </Typography>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>{t('tapShareButton')}</li>
                <li>{t('selectAddToHomeScreen')}</li>
                <li>{t('tapAdd')}</li>
              </ol>
            </div>

            {/* Instruction Images */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex flex-col gap-2">
                <Typography variant="h6" className="font-bold text-red-500">
                  1.
                </Typography>
                <div
                  className="cursor-pointer rounded-lg overflow-hidden border-2 border-gray-600 hover:border-blue-500 transition-colors"
                  onClick={() => setFullSizeImage('/ios-instruction-1.jpg')}
                >
                  <Image
                    src="/ios-instruction-1.jpg"
                    alt="iOS instruction step 1"
                    width={300}
                    height={650}
                    className="w-full h-auto"
                    unoptimized
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Typography variant="h6" className="font-bold text-red-500">
                  2.
                </Typography>
                <div
                  className="cursor-pointer rounded-lg overflow-hidden border-2 border-gray-600 hover:border-blue-500 transition-colors"
                  onClick={() => setFullSizeImage('/ios-instruction-2.jpg')}
                >
                  <Image
                    src="/ios-instruction-2.jpg"
                    alt="iOS instruction step 2"
                    width={300}
                    height={650}
                    className="w-full h-auto"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions className="flex gap-2 p-4">
          <Button onClick={handleMaybeLater} color="inherit">
            {t('maybeLater')}
          </Button>
          {timesShown >= 2 && (
            <Button onClick={handleDontRemind} color="inherit">
              {t('dontRemindMe')}
            </Button>
          )}
          <Button onClick={handleAddNow} variant="contained" color="primary">
            {t('gotIt')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full-size Image Viewer */}
      <Dialog
        open={!!fullSizeImage}
        onClose={() => setFullSizeImage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent className="relative p-0">
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
