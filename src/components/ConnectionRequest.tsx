'use client'

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { LANGUAGES } from '@/config/languages'

interface ConnectionRequestProps {
  open: boolean
  user: {
    name: string
    languages: string[]
    statuses: string[]
  } | null
  onAccept: () => void
  onReject: () => void
}

export default function ConnectionRequest({ open, user, onAccept, onReject }: ConnectionRequestProps) {
  const t = useTranslations('Status')

  if (!user) return null

  return (
    <Dialog open={open} onClose={onReject}>
      <DialogTitle>Incoming Call</DialogTitle>
      <DialogContent>
        <Typography variant="h6" className="mb-2">{user.name}</Typography>
        
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {user.languages?.map((lang) => (
              <Chip
                key={lang}
                label={LANGUAGES.find(l => l.code === lang)?.name || lang}
                size="small"
                variant="outlined"
              />
            ))}
          </div>
          
          <div className="flex flex-wrap gap-1">
            {user.statuses?.map((status) => (
              <Chip
                key={status}
                label={t(status)}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReject} color="inherit">
          Reject
        </Button>
        <Button onClick={onAccept} variant="contained" color="primary" autoFocus>
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  )
} 