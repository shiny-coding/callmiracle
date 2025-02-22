import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Chip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { User } from '@/generated/graphql'
import { useTranslations } from 'next-intl'
import { LANGUAGES } from '@/config/languages'
import { formatTextWithLinks } from '@/utils/formatTextWithLinks'
import Image from 'next/image'
import { useState } from 'react'

interface UserDetailsPopupProps {
  user: User
  open: boolean
  onClose: () => void
}

export default function UserDetailsPopup({ user, open, onClose }: UserDetailsPopupProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const [showFullImage, setShowFullImage] = useState(false)

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (user.hasImage) {
      setShowFullImage(true)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle className="flex justify-between items-center">
          {user.name}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent className="flex flex-col gap-4">
          {user.hasImage && (
            <div 
              className="relative w-full aspect-[4/3] cursor-pointer overflow-hidden rounded-lg"
              onClick={handleImageClick}
            >
              <Image
                src={`/profiles/${user.userId}.jpg`}
                alt={user.name}
                fill
                unoptimized
                className="object-cover hover:scale-105 transition-transform"
              />
            </div>
          )}

          {user.languages.length > 0 && (
            <div>
              <Typography variant="subtitle2" className="text-gray-400 mb-2">
                {t('languages')}
              </Typography>
              <div className="flex flex-wrap gap-1">
                {user.languages.map(lang => {
                  const language = LANGUAGES.find(l => l.code === lang)
                  return (
                    <Chip
                      key={lang}
                      label={language?.name || lang}
                      size="small"
                      className="text-xs text-white bg-gray-700"
                    />
                  )
                })}
              </div>
            </div>
          )}

          {user.statuses.length > 0 && (
            <div>
              <Typography variant="subtitle2" className="text-gray-400 mb-2">
                {t('status')}
              </Typography>
              <div className="flex flex-wrap gap-1">
                {user.statuses.map(status => (
                  <Chip
                    key={status}
                    label={tStatus(status)}
                    size="small"
                    className="text-xs text-white bg-gray-700"
                  />
                ))}
              </div>
            </div>
          )}

          {user.about && (
            <div>
              <Typography variant="subtitle2" className="text-gray-400 mb-2">
                {t('Profile.about')}
              </Typography>
              <Typography className="whitespace-pre-wrap">
                {formatTextWithLinks(user.about)}
              </Typography>
            </div>
          )}

          {user.contacts && (
            <div>
              <Typography variant="subtitle2" className="text-gray-400 mb-2">
                {t('Profile.contacts')}
              </Typography>
              <Typography className="whitespace-pre-wrap">
                {formatTextWithLinks(user.contacts)}
              </Typography>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showFullImage}
        onClose={() => setShowFullImage(false)}
        maxWidth={false}
        onClick={() => setShowFullImage(false)}
      >
        <div 
          className="relative w-screen h-[50vh] cursor-pointer"
          style={{ maxHeight: 'calc(100vh - 64px)' }}
        >
          <Image
            src={`/profiles/${user.userId}.jpg`}
            alt={user.name}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      </Dialog>
    </>
  )
} 