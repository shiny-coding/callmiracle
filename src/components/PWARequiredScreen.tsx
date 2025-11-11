'use client'

import { useState, useEffect } from 'react'
import { Typography, Container, Alert } from '@mui/material'
import { useTranslations } from 'next-intl'
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen'
import Image from 'next/image'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'
type Browser = 'chrome' | 'safari' | 'other'

export default function PWARequiredScreen() {
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
    // Check Safari first (before Chrome, as Chrome UA also contains Safari)
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/CriOS/.test(userAgent)) {
      setBrowser('safari')
    } else if (/Chrome/.test(userAgent) || /CriOS/.test(userAgent)) {
      setBrowser('chrome')
    } else {
      setBrowser('other')
    }
  }, [])

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black text-white overflow-auto z-50">
        <Container maxWidth="sm" className="py-8 px-4">
          {/* App Icon and Name */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg">
              <Image
                src="/logo-192.png"
                alt="CallMiracle"
                width={96}
                height={96}
                className="w-full h-full"
                unoptimized
              />
            </div>
            <Typography variant="h4" className="font-bold text-center">
              CallMiracle
            </Typography>
          </div>

          {/* Main Message */}
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-3 mb-6">
              <AddToHomeScreenIcon className="text-blue-400 text-4xl" />
            </div>

            <Alert severity="info" className="mb-6">
              <Typography variant="body1" className="font-semibold">
                {t('pwaRequiredTitle')}
              </Typography>
            </Alert>

            <Typography variant="body1" className="text-gray-300 text-center mb-8">
              {t('pwaRequiredDescription')}
            </Typography>

            {/* Platform-specific instructions */}
            {platform === 'ios' && (
              <div className="space-y-6">
                <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                  <Typography variant="subtitle1" className="font-semibold">
                    {t('howToAddToHomeScreen')}
                  </Typography>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    <li>{t('tapShareButton')}</li>
                    <li>{t('selectAddToHomeScreen')}</li>
                    <li>{t('tapAdd')}</li>
                  </ol>
                </div>

                {/* Instruction Images */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Typography variant="h6" className="font-bold text-red-500">
                      1.
                    </Typography>
                    <div
                      className="cursor-pointer rounded-lg overflow-hidden border-2 border-gray-600 hover:border-blue-500 transition-colors"
                      onClick={() => setFullSizeImage(`/ios-${browser}-instruction-1.jpg`)}
                    >
                      <Image
                        src={`/ios-${browser}-instruction-1.jpg`}
                        alt={`iOS ${browser} instruction step 1`}
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
                      onClick={() => setFullSizeImage(`/ios-${browser}-instruction-2.jpg`)}
                    >
                      <Image
                        src={`/ios-${browser}-instruction-2.jpg`}
                        alt={`iOS ${browser} instruction step 2`}
                        width={300}
                        height={650}
                        className="w-full h-auto"
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {platform === 'android' && (
              <div className="space-y-6">
                <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                  <Typography variant="subtitle1" className="font-semibold">
                    {t('howToAddToHomeScreen')}
                  </Typography>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    <li>{t('androidStep1')}</li>
                    <li>{t('androidStep2')}</li>
                    <li>{t('androidStep3')}</li>
                  </ol>
                </div>

                {/* Instruction Images */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Typography variant="h6" className="font-bold text-red-500">
                      1.
                    </Typography>
                    <div
                      className="cursor-pointer rounded-lg overflow-hidden border-2 border-gray-600 hover:border-blue-500 transition-colors"
                      onClick={() => setFullSizeImage(`/android-chrome-instruction-1.jpg`)}
                    >
                      <Image
                        src={`/android-chrome-instruction-1.jpg`}
                        alt="Android Chrome instruction step 1"
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
                      onClick={() => setFullSizeImage(`/android-chrome-instruction-2.jpg`)}
                    >
                      <Image
                        src={`/android-chrome-instruction-2.jpg`}
                        alt="Android Chrome instruction step 2"
                        width={300}
                        height={650}
                        className="w-full h-auto"
                        unoptimized
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {platform === 'desktop' && (
              <div className="bg-gray-800 p-4 rounded-lg space-y-2">
                <Typography variant="subtitle1" className="font-semibold">
                  {t('howToAddToHomeScreen')}
                </Typography>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                  <li>{t('desktopStep1')}</li>
                  <li>{t('desktopStep2')}</li>
                </ol>
              </div>
            )}

            <div className="mt-8 p-4 bg-blue-900/30 rounded-lg border border-blue-500">
              <Typography variant="body2" className="text-blue-200 text-center">
                {t('pwaRefreshNote')}
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
