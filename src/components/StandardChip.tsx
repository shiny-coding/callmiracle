'use client'

import { Chip, ChipProps } from '@mui/material'

interface StandardChipProps extends Omit<ChipProps, 'size' | 'style'> {
  /**
   * Override default style if needed
   */
  style?: React.CSSProperties
}

/**
 * StandardChip - A reusable chip component with consistent sizing and styling
 * Used across the application for filters, meetings, and other chip displays
 */
export default function StandardChip({ style, sx, ...props }: StandardChipProps) {
  return (
    <Chip
      size="small"
      style={{
        maxWidth: '100%',
        height: 'unset',
        minHeight: '28px',
        ...style
      }}
      sx={{
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        },
        ...sx
      }}
      {...props}
    />
  )
}
