'use client'

import { ThemeProvider, createTheme } from '@mui/material'
import { ReactNode } from 'react'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

export default function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={darkTheme}>
      {children}
    </ThemeProvider>
  )
} 