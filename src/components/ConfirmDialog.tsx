import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle className="bg-gray-800 text-white">
        {title}
      </DialogTitle>
      <DialogContent className="mt-4">
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions className="border-t border-gray-200">
        <Button onClick={onCancel} color="primary">
          {/* Cancel */}
          No
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="error"
          autoFocus
        >
          {/* Confirm */}
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  )
} 