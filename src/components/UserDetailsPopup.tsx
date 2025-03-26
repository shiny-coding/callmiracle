import React from 'react'
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
  const { currentUser, setCurrentUser } = useStore()
  const { updateUserData } = useUpdateUser()
  const [showFullImage, setShowFullImage] = useState(false)

  const existingBlock = currentUser?.blocks.find(b => b.userId === user._id)
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

    const updatedBlocks = currentUser.blocks.filter(b => b.userId !== user._id)
    if (blockAll || blockedStatuses.length > 0) {
      updatedBlocks.push({
        userId: user._id,
        all: blockAll,
        statuses: blockedStatuses
      })
    }

    setCurrentUser({
      ...currentUser,
      blocks: updatedBlocks
    })
    await updateUserData()
    setIsEditing(false)
    onClose()
  }

  const handleCancel = () => {
    setBlockAll(existingBlock?.all || false)
    setBlockedStatuses(existingBlock?.statuses || [])
    setIsEditing(false)
    onClose()
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
        <DialogContent className="flex flex-col gap-4 overflow-y-auto">
          {user.hasImage && (
            <div 
              className="relative w-full cursor-pointer overflow-hidden rounded-lg"
              style={{
                paddingTop: '75%' // 4:3 aspect ratio
              }}
              onClick={handleImageClick}
            >
              <Image
                src={`/profiles/${user._id}.jpg`}
                alt={user.name}
                fill
                unoptimized
                className="absolute top-0 left-0 w-full h-full object-cover hover:scale-105 transition-transform"
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
              <div className="grid grid-cols-2 gap-4">
                {leftColumnStatuses.map((leftStatus, index) => {
                  const rightStatus = rightColumnStatuses[index]
                  return (
                    <React.Fragment key={leftStatus}>
                      <Button
                        fullWidth
                        variant={blockedStatuses.includes(leftStatus) ? "contained" : "outlined"}
                        onClick={() => {
                          if (blockedStatuses.includes(leftStatus)) {
                            setBlockedStatuses(blockedStatuses.filter(s => s !== leftStatus))
                          } else {
                            setBlockedStatuses([...blockedStatuses, leftStatus])
                          }
                          setIsEditing(true)
                        }}
                        color={blockedStatuses.includes(leftStatus) ? "error" : "success"}
                        className="h-full"
                      >
                        {tStatus(leftStatus)}
                      </Button>
                      <Button
                        fullWidth
                        variant={blockedStatuses.includes(rightStatus) ? "contained" : "outlined"}
                        onClick={() => {
                          if (blockedStatuses.includes(rightStatus)) {
                            setBlockedStatuses(blockedStatuses.filter(s => s !== rightStatus))
                          } else {
                            setBlockedStatuses([...blockedStatuses, rightStatus])
                          }
                          setIsEditing(true)
                        }}
                        color={blockedStatuses.includes(rightStatus) ? "error" : "success"}
                        className="h-full"
                      >
                        {tStatus(rightStatus)}
                      </Button>
                    </React.Fragment>
                  )
                })}
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
            src={`/profiles/${user._id}.jpg`}
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