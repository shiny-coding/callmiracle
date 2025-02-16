import { Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemText, DialogActions, Button } from '@mui/material'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'

export type VideoQuality = '360p' | '480p' | '720p' | '1080p'

export interface VideoQualityConfig {
  width: number
  height: number
  maxBitrate: number
  maxFramerate: number
}

export const QUALITY_CONFIGS: Record<VideoQuality, VideoQualityConfig> = {
  '360p': {
    width: 640,
    height: 360,
    maxBitrate: 500000, // 500 Kbps
    maxFramerate: 24
  },
  '480p': {
    width: 854,
    height: 480,
    maxBitrate: 1000000, // 1 Mbps
    maxFramerate: 24
  },
  '720p': {
    width: 1280,
    height: 720,
    maxBitrate: 2000000, // 2 Mbps
    maxFramerate: 30
  },
  '1080p': {
    width: 1920,
    height: 1080,
    maxBitrate: 4000000, // 4 Mbps
    maxFramerate: 30
  }
}

interface VideoQualitySelectorProps {
  open: boolean
  onClose: () => void
}

export default function VideoQualitySelector({ open, onClose }: VideoQualitySelectorProps) {
  const { setQualityWeWantFromRemote, qualityWeWantFromRemote } = useStore()
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality | null>(qualityWeWantFromRemote)
  const { sendWantedMediaState } = useWebRTCContext()
  useEffect(() => {
    if (!open) return
    setSelectedQuality(qualityWeWantFromRemote)
  }, [qualityWeWantFromRemote, open])

  const handleApply = async () => {
    if (!selectedQuality) return
    try {
      setQualityWeWantFromRemote(selectedQuality)
      sendWantedMediaState()
      onClose()
    } catch (err) {
      console.error('Failed to change remote video quality:', err)
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        className: 'bg-gray-900 text-white'
      }}
    >
      <DialogTitle>Select Remote Video Quality</DialogTitle>
      <DialogContent>
        <List>
          {Object.entries(QUALITY_CONFIGS).map(([quality, config]) => (
            <ListItemButton
              key={quality}
              onClick={() => setSelectedQuality(quality as VideoQuality)}
              selected={quality === selectedQuality}
              className={quality === qualityWeWantFromRemote ? 'bg-gray-800' : ''}
            >
              <ListItemText
                primary={quality}
                secondary={`${config.width}x${config.height} @ ${config.maxFramerate}fps`}
                sx={{ '.MuiListItemText-secondary': { color: 'gray.400' } }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleApply}
          variant="contained" 
          disabled={!selectedQuality || selectedQuality === qualityWeWantFromRemote}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
} 