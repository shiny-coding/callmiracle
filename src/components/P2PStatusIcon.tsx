'use client'

import { IconButton, Tooltip, CircularProgress } from '@mui/material'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import BlockIcon from '@mui/icons-material/Block'
import { P2PStatus } from '@/hooks/useP2PConnectivityCheck'

interface P2PStatusIconProps {
  status: P2PStatus
  onClick: () => void
}

export default function P2PStatusIcon({ status, onClick }: P2PStatusIconProps) {
  const getIcon = () => {
    switch (status) {
      case 'online':
        return <WifiIcon style={{ color: '#22c55e' }} />
      case 'offline':
        return <WifiOffIcon style={{ color: '#ef4444' }} />
      case 'checking':
        return (
          <div style={{ position: 'relative', display: 'inline-flex', pointerEvents: 'none' }}>
            <CircularProgress size={24} style={{ color: '#fbbf24' }} />
            <WifiIcon
              style={{
                color: '#fbbf24',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '16px',
              }}
            />
          </div>
        )
      case 'online-blocked':
        return <BlockIcon style={{ color: '#f97316' }} />
    }
  }

  const getTooltip = () => {
    switch (status) {
      case 'online':
        return 'P2P connections available'
      case 'offline':
        return 'No internet connection'
      case 'checking':
        return 'Checking P2P connections availability'
      case 'online-blocked':
        return 'P2P connections blocked'
    }
  }

  return (
    <Tooltip title={getTooltip()}>
      <IconButton onClick={onClick} size="small">
        {getIcon()}
      </IconButton>
    </Tooltip>
  )
}
