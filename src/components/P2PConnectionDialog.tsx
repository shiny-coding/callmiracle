'use client'

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip, CircularProgress } from '@mui/material'
import { P2PStatus, NetworkDiagnostics } from '@/hooks/useP2PConnectivityCheck'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import SpeedIcon from '@mui/icons-material/Speed'
import RouterIcon from '@mui/icons-material/Router'

interface P2PConnectionDialogProps {
  open: boolean
  status: P2PStatus
  diagnostics: NetworkDiagnostics | null
  onClose: () => void
  onRecheck: () => void
}

export default function P2PConnectionDialog({ open, status, diagnostics, onClose, onRecheck }: P2PConnectionDialogProps) {
  const getMessage = () => {
    if (status === 'offline') {
      return {
        title: 'No Internet Connection',
        icon: <WifiOffIcon style={{ fontSize: 48, color: '#ef4444' }} />,
        message: 'Your device appears to be offline. Please check your internet connection and try again.',
        showDiagnostics: false,
      }
    }

    if (status === 'online-blocked') {
      return {
        title: 'Video Calls Not Available',
        icon: <ErrorOutlineIcon style={{ fontSize: 48, color: '#f97316' }} />,
        message: 'Your network is blocking peer-to-peer connections needed for video calls. Common causes:',
        details: [
          '• Firewall or antivirus software blocking connections',
          '• Corporate or school network restrictions',
          '• VPN or security proxy settings',
          '• Router configuration blocking P2P traffic',
        ],
        suggestion: 'Try switching to a different network (like mobile data) or temporarily disable your firewall to test. Contact your IT administrator if on a corporate network.',
        showDiagnostics: true,
      }
    }

    if (status === 'online') {
      return {
        title: 'P2P Connection Available',
        icon: <CheckCircleIcon style={{ fontSize: 48, color: '#22c55e' }} />,
        message: 'Your network supports peer-to-peer connections. Video calling should work properly.',
        showDiagnostics: true,
      }
    }

    if (status === 'checking') {
      return {
        title: 'Checking P2P Connection',
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
              Checking P2P connectivity...
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
              Network Diagnostics
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {diagnostics.effectiveType && (
                <Chip
                  icon={<SignalCellularAltIcon />}
                  label={`Connection: ${getEffectiveTypeLabel(diagnostics.effectiveType)}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {diagnostics.downlink !== undefined && (
                <Chip
                  icon={<SpeedIcon />}
                  label={`Speed: ${diagnostics.downlink} Mbps`}
                  size="small"
                  variant="outlined"
                />
              )}
              {diagnostics.rtt !== undefined && (
                <Chip
                  icon={<RouterIcon />}
                  label={`Latency: ${diagnostics.rtt}ms`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            {status === 'online' && diagnostics.srflxCandidates === 0 && diagnostics.hostCandidates > 0 && (
              <Box sx={{ mt: 2, bgcolor: '#fff3cd', p: 2, borderRadius: 1, border: '1px solid #ffc107' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  ⚠️ Connection May Be Restricted
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Video calls might not work properly. This could be caused by:
                </Typography>
                <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                  • <strong>Local firewall</strong> blocking P2P connections
                  <br />
                  • Router or network firewall settings
                  <br />
                  • VPN or security software
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  💡 Try temporarily disabling your firewall/antivirus or switching to mobile data to test.
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
          Close
        </Button>
        <Button onClick={onRecheck} variant="contained" color="primary" disabled={status === 'checking'}>
          Check Again
        </Button>
      </DialogActions>
    </Dialog>
  )
}
