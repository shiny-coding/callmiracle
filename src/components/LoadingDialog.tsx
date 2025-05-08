import { Typography, Dialog, DialogContent } from "@mui/material";

export default function LoadingDialog({ loading, error }: { loading: boolean, error: any }) {
  return (
    <Dialog
      open={true}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'bg-gray-900'
      }}
    >
      <DialogContent className="flex items-center justify-center min-h-[120px]">
        <Typography className="text-white text-center text-lg">
          {loading ? 'Loading...' : error}
        </Typography>
      </DialogContent>
    </Dialog>
  )
}