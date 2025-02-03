import { useState } from 'react'
import { IconButton, Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material'
import HdIcon from '@mui/icons-material/Hd'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'

type VideoQuality = '360p' | '480p' | '720p' | '1080p'

interface VideoQualityConfig {
  width: number
  height: number
  maxBitrate: number
  maxFramerate: number
}

const QUALITY_CONFIGS: Record<VideoQuality, VideoQualityConfig> = {
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

export default function VideoQualitySelector() {
  const [open, setOpen] = useState(false)
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>('720p')
  const { localStream } = useWebRTCContext()

  const handleQualityChange = async (quality: VideoQuality) => {
    if (!localStream) return

    const config = QUALITY_CONFIGS[quality]
    const videoTrack = localStream.getVideoTracks()[0]
    
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { max: config.maxFramerate }
        })

        // Update sender parameters if available
        const sender = (videoTrack as any).sender
        if (sender?.setParameters) {
          const params = sender.getParameters()
          if (!params.encodings) {
            params.encodings = [{}]
          }
          params.encodings[0].maxBitrate = config.maxBitrate
          params.encodings[0].maxFramerate = config.maxFramerate
          await sender.setParameters(params)
        }

        setCurrentQuality(quality)
        localStorage.setItem('videoQuality', quality)
      } catch (err) {
        console.error('Failed to apply video constraints:', err)
      }
    }
    setOpen(false)
  }

  return (
    <>
      <IconButton
        className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center">
          <HdIcon className="text-white" />
          <span className="ml-1 text-xs text-white">{currentQuality}</span>
        </div>
      </IconButton>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          className: 'bg-gray-900 text-white'
        }}
      >
        <DialogTitle>Select Video Quality</DialogTitle>
        <DialogContent>
          <List>
            {(Object.keys(QUALITY_CONFIGS) as VideoQuality[]).map((quality) => (
              <ListItemButton
                key={quality}
                onClick={() => handleQualityChange(quality)}
                selected={quality === currentQuality}
                className={quality === currentQuality ? 'bg-gray-800' : ''}
              >
                <ListItemIcon>
                  <HdIcon className="text-white" />
                </ListItemIcon>
                <ListItemText 
                  primary={quality}
                  secondary={`${QUALITY_CONFIGS[quality].width}x${QUALITY_CONFIGS[quality].height} @ ${QUALITY_CONFIGS[quality].maxFramerate}fps`}
                  sx={{ '.MuiListItemText-secondary': { color: 'gray.400' } }}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  )
} 