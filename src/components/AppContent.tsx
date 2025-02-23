'use client'

import { ReactNode } from 'react'
import { useInitUser } from '@/hooks/useInitUser'
import { Dialog, DialogContent, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
interface AppContentProps {
  children: ReactNode
}

export default function AppContent({ children }: AppContentProps) {
  const t = useTranslations()
  const { loading, error } = useInitUser()

  if (loading || error ) {
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
            {loading ? 'Loading...' : 'Server is down. Please try again later'}
          </Typography>
        </DialogContent>
      </Dialog>
    )
  }

  return children
} 
