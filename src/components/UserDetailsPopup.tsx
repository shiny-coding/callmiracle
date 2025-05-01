import React from 'react'
import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Chip, Divider, FormGroup, FormControlLabel, Checkbox, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { User, Interest } from '@/generated/graphql'
import { interestRelationships } from './InterestSelector'
import { useTranslations } from 'next-intl'
import { LANGUAGES } from '@/config/languages'
import { formatTextWithLinks } from '@/utils/formatTextWithLinks'
import Image from 'next/image'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useCheckImage } from '@/hooks/useCheckImage'
import { useMeetings } from '@/contexts/MeetingsContext'

interface UserDetailsPopupProps {
  user: User
  open: boolean
  onClose: () => void
}

export default function UserDetailsPopup({ user, open, onClose }: UserDetailsPopupProps) {
  const t = useTranslations()
  const tInterest = useTranslations('Interest')
  const { currentUser, setCurrentUser } = useStore()
  const { updateUserData } = useUpdateUser()
  const [showFullImage, setShowFullImage] = useState(false)
  const { exists: imageExists } = useCheckImage(user._id)

  const existingBlock = currentUser?.blocks.find(b => b.userId === user._id)
  const [blockAll, setBlockAll] = useState(existingBlock?.all || false)
  const [blockedInterests, setBlockedInterests] = useState<Interest[]>(existingBlock?.interests || [])
  const [isEditing, setIsEditing] = useState(false)
  const { refetchFutureMeetings } = useMeetings()
  // Split interests into left and right columns
  const leftColumnInterests = Array.from(interestRelationships.keys())
  const rightColumnInterests = Array.from(new Set(interestRelationships.values()))

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (imageExists) {
      setShowFullImage(true)
    }
  }

  const handleApply = async () => {
    if (!currentUser) return

    const updatedBlocks = currentUser.blocks.filter(b => b.userId !== user._id)
    if (blockAll || blockedInterests.length > 0) {
      updatedBlocks.push({
        userId: user._id,
        all: blockAll,
        interests: blockedInterests
      })
    }

    setCurrentUser({
      ...currentUser,
      blocks: updatedBlocks
    })
    await updateUserData()
    setIsEditing(false)
    refetchFutureMeetings()
    onClose()
  }

  const handleCancel = () => {
    setBlockAll(existingBlock?.all || false)
    setBlockedInterests(existingBlock?.interests || [])
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
          {imageExists && (
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
                {t('blockInterests')}
              </Typography>
              <div className="grid grid-cols-2 gap-4">
                {leftColumnInterests.map((leftInterest, index) => {
                  const rightInterest = rightColumnInterests[index]
                  return (
                    <React.Fragment key={leftInterest}>
                      <Button
                        fullWidth
                        variant={blockedInterests.includes(leftInterest) ? "contained" : "outlined"}
                        onClick={() => {
                          if (blockedInterests.includes(leftInterest)) {
                            setBlockedInterests(blockedInterests.filter(i => i !== leftInterest))
                          } else {
                            setBlockedInterests([...blockedInterests, leftInterest])
                          }
                          setIsEditing(true)
                        }}
                        color={blockedInterests.includes(leftInterest) ? "error" : "success"}
                        className="h-full"
                      >
                        {tInterest(leftInterest)}
                      </Button>
                      <Button
                        fullWidth
                        variant={blockedInterests.includes(rightInterest) ? "contained" : "outlined"}
                        onClick={() => {
                          if (blockedInterests.includes(rightInterest)) {
                            setBlockedInterests(blockedInterests.filter(i => i !== rightInterest))
                          } else {
                            setBlockedInterests([...blockedInterests, rightInterest])
                          }
                          setIsEditing(true)
                        }}
                        color={blockedInterests.includes(rightInterest) ? "error" : "success"}
                        className="h-full"
                      >
                        {tInterest(rightInterest)}
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