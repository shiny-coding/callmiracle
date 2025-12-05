import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import CallIcon from '@mui/icons-material/Call'
import { useTranslations } from 'next-intl'
import CallUserInfo from './CallUserInfo'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { formatDuration } from '@/utils/formatDuration'
import { useEffect } from 'react'

export default function CallEndedDialog() {
  const t = useTranslations()
  const { doCall } = useWebRTCContext()
  const { callEndedInfo, setCallEndedInfo } = useStore((state) => ({
    callEndedInfo: state.callEndedInfo,
    setCallEndedInfo: state.setCallEndedInfo
  }))

  useEffect(() => {
    console.log('CallEndedDialog: callEndedInfo changed', {
      hasInfo: !!callEndedInfo,
      user: callEndedInfo?.user?.name,
      durationS: callEndedInfo?.durationS
    })
  }, [callEndedInfo])

  const handleClose = () => {
    setCallEndedInfo(null)
  }

  const handleCallAgain = async () => {
    if (callEndedInfo?.user) {
      const user = callEndedInfo.user
      const meetingId = callEndedInfo.meetingId || null
      setCallEndedInfo(null)
      await doCall(user, meetingId, null)
    }
  }

  if (!callEndedInfo) return null

  return (
    <Dialog
      open={!!callEndedInfo}
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
        {t('callEnded')}
      </DialogTitle>
      <DialogContent>
        <CallUserInfo user={callEndedInfo.user} />
        <Typography variant="body1" className="mt-4 text-center dimmer-text-color">
          {t('callDuration')}: {formatDuration(callEndedInfo.durationS)}
        </Typography>
      </DialogContent>
      <DialogActions className="border-t brighter-border">
        <Button onClick={handleClose} variant="contained" color="inherit">
          {t('close')}
        </Button>
        <Button onClick={handleCallAgain} variant="contained" color="success" startIcon={<CallIcon />}>
          {t('callAgain')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
