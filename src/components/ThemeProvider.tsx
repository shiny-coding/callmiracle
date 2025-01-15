'use client'

import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material'
import { useEffect, useState } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
  }, [])

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
    }
  })

  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
} 