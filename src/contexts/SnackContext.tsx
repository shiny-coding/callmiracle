import React, { createContext, useState, useContext, ReactNode } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert, { AlertColor } from '@mui/material/Alert'

interface SnackbarContextType {
  showSnackbar: (message: string, severity?: AlertColor, onClick?: () => void) => void
}

const SnackContext = createContext<SnackbarContextType | undefined>(undefined)

export const useSnackbar = () => {
  const context = useContext(SnackContext)
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider')
  }
  return context
}

interface SnackbarProviderProps {
  children: ReactNode
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<AlertColor>('info') // Default severity
  const [onClick, setOnClick] = useState<(() => void) | undefined>(undefined)

  const showSnackbar = (newMessage: string, newSeverity: AlertColor = 'info', newOnClick?: () => void) => {
    setMessage(newMessage)
    setSeverity(newSeverity)
    setOnClick(() => newOnClick) // Store function in state
    setOpen(true)
  }

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }
    setOpen(false)
    setOnClick(undefined) // Clear the onClick handler
  }

  const handleSnackbarClick = () => {
    if (onClick) {
      onClick()
      setOpen(false)
      setOnClick(undefined)
    }
  }

  return (
    <SnackContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClick={onClick ? handleSnackbarClick : undefined}
        sx={onClick ? { cursor: 'pointer' } : {}}
      >
        <Alert 
          onClose={handleClose} 
          severity={severity} 
          sx={{ 
            width: '100%',
            ...(onClick ? { cursor: 'pointer' } : {})
          }}
          onClick={onClick ? handleSnackbarClick : undefined}
        >
          {message}
        </Alert>
      </Snackbar>
    </SnackContext.Provider>
  )
} 