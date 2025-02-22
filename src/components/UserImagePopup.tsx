import { Dialog } from '@mui/material'
import Image from 'next/image'

interface UserImagePopupProps {
  userId: string
  open: boolean
  onClose: () => void
}

export default function UserImagePopup({ userId, open, onClose }: UserImagePopupProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      onClick={onClose}
    >
      <div className="relative w-screen h-screen max-h-[90vh] cursor-pointer">
        <Image
          src={`/profiles/${userId}.jpg`}
          alt="User photo"
          fill
          className="object-contain"
          unoptimized
        />
      </div>
    </Dialog>
  )
} 