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
          '&:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--hover-input-border-color)',
          },
        },
        notchedOutline: {
          borderColor: 'var(--input-border-color)' // <-- your desired border color
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
          backgroundColor: 'var(--input-bg)',
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'var(--brighter-color)' // your desired popup menu background
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--normal-color)', // your desired Paper background color
          backgroundImage: 'none'
        }
      }
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--brighter-color)',
          padding: '1rem'
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(50, 150, 150, 0.7)', // adjust alpha for transparency
          color: '#fff'
        }
      }
    },
    MuiInput: {
      styleOverrides: {
        underline: {
          '&:after': {
            borderBottomColor: 'var(--border-color)'
          }
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          width: 'calc(100% - (var(--ai-scale) * 64px))',
          margin: 'var(--32sp)',
          maxWidth: '700px'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxSizing: 'border-box',
        },
        contained: {
          // Assuming the outlined border is 1px. Adjust if it's different.
          border: '1px solid transparent',
          padding: '0.35rem',
        },
        outlined: {
          // Explicitly define border for consistency if needed,
          // or ensure it matches the transparent border width of contained.
          border: '1px solid', // Color will be from palette or specific overrides,
          padding: '0.35rem',
        },
      }
    },
  }
})


export default function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  )
} 