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
      color="primary"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      sx={{
        position: 'absolute',
        bottom: 16,
        right: 16,
      }}
    >
      <AddIcon />
    </Fab>
  )
}
