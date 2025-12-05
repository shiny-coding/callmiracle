'use client'

import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import CallIcon from '@mui/icons-material/Call'
import { useTranslations } from 'next-intl'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useEffect, useState } from 'react'
import { gql, useQuery } from '@apollo/client'
import CallUserInfo from './CallUserInfo'

const GET_USER = gql`
  query GetUser($userId: ID!) {
    getUser(userId: $userId) {
      _id
      name
      languages
      about
      sex
      birthYear
    }
  }
`

export default function MissedCallDialog() {
  const t = useTranslations()
  const { pendingMissedCall, setPendingMissedCall } = useStore((state) => ({
    pendingMissedCall: state.pendingMissedCall,
    setPendingMissedCall: state.setPendingMissedCall
  }))
  const { doCall } = useWebRTCContext()

  const { data, loading } = useQuery(GET_USER, {
    variables: { userId: pendingMissedCall?.peerUserId },
    skip: !pendingMissedCall?.peerUserId
  })

  const user = data?.getUser
  const open = !!pendingMissedCall && !!user

  const handleClose = () => {
    setPendingMissedCall(null)
  }

  const handleCallback = () => {
    if (user) {
      const meetingId = pendingMissedCall?.meetingId || null
      const userToCall = user
      setPendingMissedCall(null)
      // Use setTimeout to ensure dialog closes before CallerDialog opens
      setTimeout(() => {
        doCall(userToCall, meetingId, null)
      }, 100)
    }
  }

  if (!pendingMissedCall || loading) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        className: 'card-bg text-color min-w-[300px]'
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)'
          }
        }
      }}
    >
      <DialogTitle className="text-center">
        {t('notificationMessages.missedCallTitle')}
      </DialogTitle>
      <DialogContent>
        {user && <CallUserInfo user={user} compact />}
      </DialogContent>
      <DialogActions className="border-t brighter-border">
        <Button onClick={handleClose} variant="contained" color="inherit">
          {t('close')}
        </Button>
        <Button
          onClick={handleCallback}
          variant="contained"
          color="success"
          startIcon={<CallIcon sx={{ color: 'white' }} />}
        >
          {t('callback')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
