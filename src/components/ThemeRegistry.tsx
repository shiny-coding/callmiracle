'use client'

import { ThemeProvider } from '@mui/material'
import { ReactNode } from 'react'
import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1565c0',
      light: '#1976d2',
      dark: '#0d47a1',
    },
    background: {
      default: 'transparent',
      paper: 'transparent',
    },
    text: {
      primary: '#000000',
      secondary: '#4a4a4a',
    },
  },
  components: {
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)', // light background for menus
          color: 'var(--text-color)',
          '& .MuiSvgIcon-root': {
            color: 'var(--dimmer-text-color)',
          },
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: 'var(--text-color)',
        }
      }
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: 'var(--dimmer-text-color)',
        }
      }
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: 'var(--dimmer-text-color)',
        }
      }
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: 'var(--text-color)',
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
    MuiFormControl: {
      styleOverrides: {
        root: {
          // Ensure Select components create proper notch for labels
          '& .MuiInputLabel-outlined + .MuiInput-formControl .MuiOutlinedInput-notchedOutline': {
            '& legend': {
              maxWidth: '1000px',
            },
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        // Ensure all selects use the notched prop when they have labels
        MenuProps: {
          PaperProps: {
            style: {
              marginTop: 8,
            },
          },
        },
      },
      styleOverrides: {
        root: {
          // When Select is used with FormControl and InputLabel, ensure notched outline
          '.MuiFormControl-root &': {
            '& .MuiOutlinedInput-notchedOutline': {
              '& legend': {
                maxWidth: '1000px',
              },
            },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          '&:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--hover-input-border-color)',
          },
          // Force notched outline to create legend space for labels
          '& .MuiOutlinedInput-notchedOutline': {
            '& legend': {
              maxWidth: '1000px',
              // Force the legend to always have some width when there's a label
              '&:not(:empty)': {
                width: 'auto',
                maxWidth: '1000px',
              },
            },
          },
        },
        notchedOutline: {
          borderColor: 'var(--input-border-color)',
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          // Ensure proper positioning
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -6px) scale(0.75)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '0 4px',
            zIndex: 1,
          },
        },
      },
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