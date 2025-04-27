'use client'

import { ThemeProvider } from '@mui/material'
import { ReactNode } from 'react'
import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark'
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          // backgroundColor: '#f0f0f0' // your desired color
        }
      }
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          // backgroundColor: '#f0f0f0'
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: '#273d58'
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#273d58' // your desired popup menu background
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e2b3f', // your desired Paper background color
          backgroundImage: 'none'
        }
      }
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          backgroundColor: '#273d58',
          padding: '1rem'
        }
      }
    }
  }
})


export default function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  )
} 