'use client'

import { IconButton } from '@mui/material'
import PictureInPictureIcon from '@mui/icons-material/PictureInPicture'

export type VideoLayoutMode = 'overlay' | 'split' | 'collapsed'

interface VideoLayoutControlsProps {
  mode: VideoLayoutMode
  onModeChange: (mode: VideoLayoutMode) => void
  isSplitHorizontal?: boolean
  className?: string
}

export default function VideoLayoutControls({ mode, onModeChange, isSplitHorizontal = true, className = '' }: VideoLayoutControlsProps) {
  const cycleMode = () => {
    const modes: VideoLayoutMode[] = ['overlay', 'split', 'collapsed']
    const currentIndex = modes.indexOf(mode)
    const nextIndex = (currentIndex + 1) % modes.length
    onModeChange(modes[nextIndex])
  }

  return (
    <IconButton
      className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
      onClick={cycleMode}
      title="Toggle layout mode"
      size="small"
      sx={{
        '@media (max-width: 768px)': {
          padding: '8px',
        },
      }}
    >
      <PictureInPictureIcon
        sx={{
          color: 'white',
          filter: 'drop-shadow(0 0 2px black)',
          '@media (max-width: 768px)': {
            fontSize: '1.5rem',
          },
        }}
      />
    </IconButton>
  )
}
