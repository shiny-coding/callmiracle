import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress
} from '@mui/material'
import { useTranslations } from 'next-intl'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  destructive?: boolean
}

export default function ConfirmationDialog({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
  destructive = false
}: ConfirmationDialogProps) {
  const t = useTranslations()

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'bg-gray-800 text-white'
      }}
    >
      <DialogTitle className="text-white">
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography className="text-gray-300">
          {message}
        </Typography>
      </DialogContent>
      <DialogActions className="p-4">
        <Button
          onClick={onCancel}
          disabled={loading}
          className="text-gray-300 hover:text-white"
        >
          {cancelText || t('cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          className={`${
            destructive 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <CircularProgress size={20} className="text-white" />
          ) : (
            confirmText || t('confirm')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 