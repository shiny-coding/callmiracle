import { Typography, Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import { useState } from "react";
import { useTranslations } from 'next-intl';

export default function LoadingDialog({ loading, error }: { loading: boolean, error: any }) {
  const t = useTranslations();
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
        sx: { zIndex: 1300, backgroundColor: 'white' } // Lower than top/bottom controls (which should be 1400+)
      }}
      sx={{ zIndex: 1300 }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'transparent' }
        }
      }}
    >
      <DialogContent className="flex items-center justify-center min-h-[120px] relative">
        {!loading && (
          <IconButton
            onClick={handleClose}
            className="absolute top-2 right-2 dimmer-text-color"
            size="small"
          >
            <CloseIcon />
          </IconButton>
        )}
        <Typography className="text-color text-center text-lg pr-8">
          {loading ? t('loading') : (error?.message || error || t('error'))}
        </Typography>
      </DialogContent>
    </Dialog>
  )
}