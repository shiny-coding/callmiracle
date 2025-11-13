import { Typography, Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import { useState } from "react";

export default function LoadingDialog({ loading, error }: { loading: boolean, error: any }) {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    if (!loading) {
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      onClose={handleClose}
      PaperProps={{
        className: 'bg-gray-900',
        sx: { zIndex: 1300 } // Lower than top/bottom controls (which should be 1400+)
      }}
      sx={{ zIndex: 1300 }}
    >
      <DialogContent className="flex items-center justify-center min-h-[120px] relative">
        {!loading && (
          <IconButton
            onClick={handleClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
            size="small"
          >
            <CloseIcon />
          </IconButton>
        )}
        <Typography className="text-white text-center text-lg pr-8">
          {loading ? 'Loading...' : (error?.message || error || 'An error occurred')}
        </Typography>
      </DialogContent>
    </Dialog>
  )
}