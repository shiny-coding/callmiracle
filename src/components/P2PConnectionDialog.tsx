'use client'

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip, CircularProgress } from '@mui/material'
import { P2PStatus, NetworkDiagnostics } from '@/hooks/useP2PConnectivityCheck'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import SpeedIcon from '@mui/icons-material/Speed'
import RouterIcon from '@mui/icons-material/Router'
import { useTranslations } from 'next-intl'

interface P2PConnectionDialogProps {
  open: boolean
  status: P2PStatus
  diagnostics: NetworkDiagnostics | null
  onClose: () => void
  onRecheck: () => void
}

export default function P2PConnectionDialog({ open, status, diagnostics, onClose, onRecheck }: P2PConnectionDialogProps) {
  const t = useTranslations('P2P')

  const getMessage = () => {
    if (status === 'offline') {
      return {
        title: t('dialogTitleOffline'),
        icon: <WifiOffIcon style={{ fontSize: 48, color: '#ef4444' }} />,
        message: t('dialogMessageOffline'),
        showDiagnostics: false,
      }
    }

    if (status === 'online-blocked') {
      return {
        title: t('dialogTitleBlocked'),
        icon: <ErrorOutlineIcon style={{ fontSize: 48, color: '#f97316' }} />,
        message: t('dialogMessageBlocked'),
        details: [
          t('causeFirewall'),
          t('causeNetwork'),
          t('causeVPN'),
          t('causeRouter'),
        ],
        suggestion: t('suggestionSwitch'),
        showDiagnostics: true,
      }
    }

    if (status === 'online') {
      return {
        title: t('dialogTitleOnline'),
        icon: <CheckCircleIcon style={{ fontSize: 48, color: '#22c55e' }} />,
        message: t('dialogMessageOnline'),
        showDiagnostics: true,
      }
    }

    if (status === 'checking') {
      return {
        title: t('dialogTitleChecking'),
        icon: null,
        message: '',
        showDiagnostics: false,
      }
    }

    return null
  }

  const content = getMessage()
  if (!content) return null

  const getEffectiveTypeLabel = (type?: string) => {
    const labels: { [key: string]: string } = {
      'slow-2g': 'Slow 2G',
      '2g': '2G',
      '3g': '3G',
      '4g': '4G',
    }
    return type ? labels[type] || type : 'Unknown'
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {content.icon ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {content.icon}
            <span>{content.title}</span>
          </div>
        ) : (
          <span>{content.title}</span>
        )}
      </DialogTitle>
      <DialogContent>
        {status === 'checking' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              {t('checkingMessage')}
            </Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ mb: 2 }}>{content.message}</Typography>

            {content.details && (
              <Box sx={{ mb: 2, pl: 2 }}>
                {content.details.map((detail, index) => (
                  <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                    {detail}
                  </Typography>
                ))}
              </Box>
            )}

            {content.suggestion && (
              <Box sx={{ mb: 2, pl: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  💡 {content.suggestion}
                </Typography>
              </Box>
            )}

            {content.showDiagnostics && diagnostics && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              {t('networkDiagnostics')}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {diagnostics.effectiveType && (
                <Chip
                  icon={<SignalCellularAltIcon />}
                  label={`${t('connection')}: ${getEffectiveTypeLabel(diagnostics.effectiveType)}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {diagnostics.downlink !== undefined && (
                <Chip
                  icon={<SpeedIcon />}
                  label={`${t('speed')}: ${diagnostics.downlink} Mbps`}
                  size="small"
                  variant="outlined"
                />
              )}
              {diagnostics.rtt !== undefined && (
                <Chip
                  icon={<RouterIcon />}
                  label={`${t('latency')}: ${diagnostics.rtt}ms`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            {status === 'online' && diagnostics.srflxCandidates === 0 && diagnostics.hostCandidates > 0 && (
              <Box sx={{ mt: 2, bgcolor: '#fff3cd', p: 2, borderRadius: 1, border: '1px solid #ffc107' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('restrictionTitle')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {t('restrictionMessage')}
                </Typography>
                <Typography variant="body2" component="div" sx={{ mb: 1 }} dangerouslySetInnerHTML={{
                  __html: `${t('restrictionFirewall')}<br />${t('restrictionRouter')}<br />${t('restrictionVPN')}`
                }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t('restrictionSuggestion')}
                </Typography>
              </Box>
            )}
          </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('close')}
        </Button>
        <Button onClick={onRecheck} variant="contained" color="primary" disabled={status === 'checking'}>
          {t('checkAgain')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
