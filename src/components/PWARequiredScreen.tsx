'use client'

import { useState, useEffect } from 'react'
import { Typography, Container, Alert } from '@mui/material'
import { useTranslations } from 'next-intl'
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
      <div className="fixed inset-0 overflow-auto z-50">
        <Container maxWidth="sm" className="py-10 px-4">
            {/* App Icon and Name */}
            <div className="flex justify-center mb-10">
              <div
                className="inline-grid items-center gap-4"
                style={{ gridTemplateColumns: 'auto 1fr auto' }}
              >
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
                    <Image
                      src="/logo-192.png"
                      alt="CallMiracle"
                      width={64}
                      height={64}
                      className="w-full h-full"
                      unoptimized
                    />
                  </div>
                </div>
                <div className="flex justify-center">
                  <Typography variant="h4" className="font-bold text-slate-900 text-center">
                    CallMiracle
                  </Typography>
                </div>
                <div className="w-16" aria-hidden="true" />
              </div>
            </div>

            {/* Main Message */}
            <div className="space-y-6">
              <Alert severity="info" className="mb-4">
                <Typography
                  variant="body1"
                  className="text-slate-900"
                  sx={{ fontWeight: 500 }}
                >
                  {t('pwaRequiredTitle')}
                </Typography>
              </Alert>

              <Typography variant="body1" className="text-slate-700 text-center mb-4">
                {t('pwaRequiredDescription')}
              </Typography>

              {/* Platform-specific instructions */}
              {platform === 'ios' && (
                <div className="space-y-6">
                  <div
                    className="p-4 rounded-xl shadow-md border border-blue-100 space-y-2"
                    style={{ backgroundColor: 'var(--card-bg)' }}
                  >
                    <Typography variant="subtitle1" className="font-semibold text-slate-900">
                      {t('howToAddToHomeScreen')}
                    </Typography>
                    <ol className="list-decimal list-inside space-y-2 text-base text-slate-700">
                      <li>{t('tapShareButton')}</li>
                      <li>{t('selectAddToHomeScreen')}</li>
                      <li>{t('tapAdd')}</li>
                      <li>{t('pwaRefreshNote')}</li>
                    </ol>
                  </div>

                  {/* Instruction Images (hidden for now to keep layout) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Typography variant="h6" className="font-bold text-red-500">
                        1.
                      </Typography>
                      <div
                        className="cursor-pointer rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-500 transition-colors shadow-sm bg-white/80"
                        onClick={() => setFullSizeImage(`/ios-${browser}-instruction-1.jpg`)}
                      >
                        <Image
                          src={`/ios-${browser}-instruction-1.jpg`}
                          alt={`iOS ${browser} instruction step 1`}
                          width={300}
                          height={650}
                          className="w-full h-auto"
                          unoptimized
                          style={{ visibility: 'hidden' }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Typography variant="h6" className="font-bold text-red-500">
                        2.
                      </Typography>
                      <div
                        className="cursor-pointer rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-500 transition-colors shadow-sm bg-white/80"
                        onClick={() => setFullSizeImage(`/ios-${browser}-instruction-2.jpg`)}
                      >
                        <Image
                          src={`/ios-${browser}-instruction-2.jpg`}
                          alt={`iOS ${browser} instruction step 2`}
                          width={300}
                          height={650}
                          className="w-full h-auto"
                          unoptimized
                          style={{ visibility: 'hidden' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {platform === 'android' && (
                <div className="space-y-6">
                  <div
                    className="p-4 rounded-xl shadow-md border border-blue-100 space-y-2"
                    style={{ backgroundColor: 'var(--card-bg)' }}
                  >
                    <Typography variant="subtitle1" className="font-semibold text-slate-900">
                      {t('howToAddToHomeScreen')}
                    </Typography>
                    <ol className="list-decimal list-inside space-y-2 text-base text-slate-700">
                      <li>{t('androidStep1')}</li>
                      <li>{t('androidStep2')}</li>
                      <li>{t('androidStep3')}</li>
                      <li>{t('pwaRefreshNote')}</li>
                    </ol>
                  </div>

                  {/* Instruction Images (hidden for now to keep layout) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Typography variant="h6" className="font-bold text-red-500">
                        1.
                      </Typography>
                      <div
                        className="cursor-pointer rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-500 transition-colors shadow-sm bg-white/80"
                        onClick={() => setFullSizeImage(`/android-chrome-instruction-1.jpg`)}
                      >
                        <Image
                          src={`/android-chrome-instruction-1.jpg`}
                          alt="Android Chrome instruction step 1"
                          width={300}
                          height={650}
                          className="w-full h-auto"
                          unoptimized
                          style={{ visibility: 'hidden' }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Typography variant="h6" className="font-bold text-red-500">
                        2.
                      </Typography>
                      <div
                        className="cursor-pointer rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-500 transition-colors shadow-sm bg-white/80"
                        onClick={() => setFullSizeImage(`/android-chrome-instruction-2.jpg`)}
                      >
                        <Image
                          src={`/android-chrome-instruction-2.jpg`}
                          alt="Android Chrome instruction step 2"
                          width={300}
                          height={650}
                          className="w-full h-auto"
                          unoptimized
                          style={{ visibility: 'hidden' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {platform === 'desktop' && (
                <div
                className="p-4 rounded-xl shadow-md border border-blue-100 space-y-2"
                style={{ backgroundColor: 'var(--card-bg)' }}
              >
                <Typography variant="subtitle1" className="font-semibold text-slate-900">
                  {t('howToAddToHomeScreen')}
                </Typography>
                <ol className="list-decimal list-inside space-y-2 text-base text-slate-700">
                  <li>{t('desktopStep1')}</li>
                  <li>{t('desktopStep2')}</li>
                  <li>{t('pwaRefreshNote')}</li>
                </ol>
              </div>
            )}
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
        <DialogContent className="relative p-0 bg-white">
          <IconButton
            onClick={() => setFullSizeImage(null)}
            className="absolute top-2 right-2 z-10 bg-white/70 hover:bg-white"
            size="small"
          >
            <CloseIcon className="text-slate-800" />
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
