import { Dialog, DialogTitle, DialogContent, TextField, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import LanguageSelector from './LanguageSelector'

interface ProfileSettingsProps {
  open: boolean
  onClose: () => void
}

export default function ProfileSettings({ open, onClose }: ProfileSettingsProps) {
  const t = useTranslations('Profile')
  const { name, setName } = useStore()
  const [uploading, setUploading] = useState(false)
  const [timestamp, setTimestamp] = useState(Date.now())
  const userId = getUserId()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', acceptedFiles[0])
      formData.append('userId', userId)
      
      await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData
      })
      setTimestamp(Date.now())
    } catch (error) {
      console.error('Error uploading photo:', error)
    } finally {
      setUploading(false)
    }
  }, [userId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    maxFiles: 1
  })

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="flex justify-between items-center">
        {t('title')}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <div 
          {...getRootProps()} 
          className={`
            w-full aspect-square max-w-[240px] mx-auto rounded-lg border-2 border-dashed 
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} 
            flex items-center justify-center cursor-pointer overflow-hidden
            hover:border-blue-500 transition-colors
          `}
        >
          <input {...getInputProps()} />
          {userId ? (
            <div className="relative w-full h-full">
              <Image
                src={`/profiles/${userId}.jpg?t=${timestamp}`}
                alt={t('photo')}
                fill
                unoptimized
                className="object-cover"
                onError={(e) => {
                  // Show upload text if image fails to load
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.nextElementSibling?.classList.add('flex')
                }}
              />
              <div className="absolute inset-0 hidden items-center justify-center text-gray-500">
                {uploading ? t('uploading') : t('uploadPhoto')}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              {uploading ? t('uploading') : t('uploadPhoto')}
            </div>
          )}
        </div>

        <TextField
          label={t('name')}
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <LanguageSelector />
      </DialogContent>
    </Dialog>
  )
} 