'use client'

import { IconButton } from '@mui/material'
import PictureInPictureIcon from '@mui/icons-material/PictureInPicture'
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'

export type VideoLayoutMode = 'overlay' | 'split' | 'collapsed'

interface VideoLayoutControlsProps {
  mode: VideoLayoutMode
  onModeChange: (mode: VideoLayoutMode) => void
  className?: string
}

export default function VideoLayoutControls({ mode, onModeChange, className = '' }: VideoLayoutControlsProps) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <IconButton
        className={`backdrop-blur-sm ${mode === 'overlay' ? 'bg-blue-500/50 hover:bg-blue-600/50' : 'bg-black/30 hover:bg-black/40'}`}
        onClick={() => onModeChange('overlay')}
        title="Overlay mode"
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

      <IconButton
        className={`backdrop-blur-sm ${mode === 'split' ? 'bg-blue-500/50 hover:bg-blue-600/50' : 'bg-black/30 hover:bg-black/40'}`}
        onClick={() => onModeChange('split')}
        title="Split mode"
        size="small"
        sx={{
          '@media (max-width: 768px)': {
            padding: '8px',
          },
        }}
      >
        <ViewAgendaIcon
          sx={{
            color: 'white',
            filter: 'drop-shadow(0 0 2px black)',
            '@media (max-width: 768px)': {
              fontSize: '1.5rem',
            },
          }}
        />
      </IconButton>

      <IconButton
        className={`backdrop-blur-sm ${mode === 'collapsed' ? 'bg-blue-500/50 hover:bg-blue-600/50' : 'bg-black/30 hover:bg-black/40'}`}
        onClick={() => onModeChange('collapsed')}
        title="Hide local video"
        size="small"
        sx={{
          '@media (max-width: 768px)': {
            padding: '8px',
          },
        }}
      >
        <UnfoldLessIcon
          sx={{
            color: 'white',
            filter: 'drop-shadow(0 0 2px black)',
            '@media (max-width: 768px)': {
              fontSize: '1.5rem',
            },
          }}
        />
      </IconButton>
    </div>
  )
}
