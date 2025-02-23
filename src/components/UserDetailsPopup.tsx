import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Chip, Divider, FormGroup, FormControlLabel, Checkbox, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { User, Status } from '@/generated/graphql'
import { statusRelationships } from './StatusSelector'
import { useTranslations } from 'next-intl'
import { LANGUAGES } from '@/config/languages'
import { formatTextWithLinks } from '@/utils/formatTextWithLinks'
import Image from 'next/image'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUpdateUser } from '@/hooks/useUpdateUser'

interface UserDetailsPopupProps {
  user: User
  open: boolean
  onClose: () => void
}

export default function UserDetailsPopup({ user, open, onClose }: UserDetailsPopupProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const { user: currentUser, setUser } = useStore()
  const { updateUserData } = useUpdateUser()
  const [showFullImage, setShowFullImage] = useState(false)

  const existingBlock = currentUser?.blocks.find(b => b.userId === user.userId)
  const [blockAll, setBlockAll] = useState(existingBlock?.all || false)
  const [blockedStatuses, setBlockedStatuses] = useState<Status[]>(existingBlock?.statuses || [])
  const [isEditing, setIsEditing] = useState(false)

  // Split statuses into left and right columns
  const leftColumnStatuses = Array.from(statusRelationships.keys())
  const rightColumnStatuses = Array.from(new Set(statusRelationships.values()))

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (user.hasImage) {
      setShowFullImage(true)
    }
  }

  const handleApply = async () => {
    if (!currentUser) return

    const updatedBlocks = currentUser.blocks.filter(b => b.userId !== user.userId)
    if (blockAll || blockedStatuses.length > 0) {
      updatedBlocks.push({
        userId: user.userId,
        all: blockAll,
        statuses: blockedStatuses
      })
    }

    setUser({
      ...currentUser,
      blocks: updatedBlocks
    })
    await updateUserData()
    setIsEditing(false)
  }

  const handleCancel = () => {
    setBlockAll(existingBlock?.all || false)
    setBlockedStatuses(existingBlock?.statuses || [])
    setIsEditing(false)
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

          {/* Block controls section */}
          <Divider className="my-4" />
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={blockAll}
                  onChange={(e) => {
                    setBlockAll(e.target.checked)
                    setIsEditing(true)
                  }}
                  className="text-red-500"
                />
              }
              label={t('blockUser')}
            />
          </FormGroup>

          {!blockAll && (
            <>
              <Typography variant="subtitle1" className="mt-2">
                {t('blockStatuses')}
              </Typography>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="space-y-3">
                  {leftColumnStatuses.map((status) => (
                    <Button
                      key={status}
                      fullWidth
                      variant={blockedStatuses.includes(status) ? "contained" : "outlined"}
                      onClick={() => {
                        if (blockedStatuses.includes(status)) {
                          setBlockedStatuses(blockedStatuses.filter(s => s !== status))
                        } else {
                          setBlockedStatuses([...blockedStatuses, status])
                        }
                        setIsEditing(true)
                      }}
                      color={blockedStatuses.includes(status) ? "error" : "inherit"}
                    >
                      {tStatus(status)}
                    </Button>
                  ))}
                </div>
                <div className="space-y-3">
                  {rightColumnStatuses.map((status) => (
                    <Button
                      key={status}
                      fullWidth
                      variant={blockedStatuses.includes(status) ? "contained" : "outlined"}
                      onClick={() => {
                        if (blockedStatuses.includes(status)) {
                          setBlockedStatuses(blockedStatuses.filter(s => s !== status))
                        } else {
                          setBlockedStatuses([...blockedStatuses, status])
                        }
                        setIsEditing(true)
                      }}
                      color={blockedStatuses.includes(status) ? "error" : "inherit"}
                    >
                      {tStatus(status)}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          {isEditing && (
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleCancel}>
                {t('cancel')}
              </Button>
              <Button 
                onClick={handleApply}
                variant="contained"
                color="primary"
              >
                {t('apply')}
              </Button>
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