'use client'

import { Fab } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

interface AddFabProps {
  onClick: () => void
  ariaLabel: string
  title: string
}

export default function AddFab({ onClick, ariaLabel, title }: AddFabProps) {
  return (
    <Fab
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      sx={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        backgroundImage: 'url(/clouds.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: '1px solid var(--icon-color-primary)',
        '&:hover': {
          opacity: 0.9,
        },
        '& .MuiSvgIcon-root': {
          color: 'var(--icon-color-primary)',
        },
      }}
    >
      <AddIcon />
    </Fab>
  )
}
