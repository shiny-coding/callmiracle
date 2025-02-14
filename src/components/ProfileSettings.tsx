import { Dialog, DialogTitle, DialogContent, TextField, IconButton, DialogActions, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import { useCallback, useState, useEffect } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import LanguageSelector from './LanguageSelector'
import { useUpdateUser } from '@/hooks/useUpdateUser'

interface ProfileSettingsProps {
  open: boolean
  onClose: () => void
}

export default function ProfileSettings({ open, onClose }: ProfileSettingsProps) {
  const t = useTranslations('Profile')
  const { name, setName, languages, setLanguages, hasImage, setHasImage } = useStore()
  const [tempName, setTempName] = useState(name)
  const [tempLanguages, setTempLanguages] = useState(languages)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [timestamp, setTimestamp] = useState(Date.now())
  const userId = getUserId()
  const { updateUserData } = useUpdateUser()

  useEffect(() => {
    if (open) {
      setTempName(name)
      setTempLanguages(languages)
      setSelectedFile(null)
      setTimestamp(Date.now())
    }
  }, [open, name, languages])

  const handleCancel = () => {
    setTempName(name)
    setTempLanguages(languages)
    setSelectedFile(null)
    onClose()
  }

  const handleApply = async () => {
    setUploading(true)
    try {
      if (selectedFile) {
        const formData = new FormData()
        formData.append('photo', selectedFile)
        formData.append('userId', userId)
        
        await fetch('/api/upload-photo', {
          method: 'POST',
          body: formData
        })
        setHasImage(true)
      }

      setName(tempName)
      setLanguages(tempLanguages)
      await updateUserData()
      onClose()
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    setSelectedFile(acceptedFiles[0])
  }, [])

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
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="flex justify-between items-center">
        {t('title')}
        <IconButton onClick={handleCancel} size="small">
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
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                {uploading ? t('uploading') : selectedFile ? selectedFile.name : t('uploadPhoto')}
              </div>
              {(hasImage || selectedFile) && (
                <Image
                  src={selectedFile ? URL.createObjectURL(selectedFile) : `/profiles/${userId}.jpg?t=${timestamp}`}
                  alt={t('photo')}
                  fill
                  unoptimized
                  className="object-cover"
                  onLoad={(e) => {
                    const target = e.target as HTMLImageElement
                    target.nextElementSibling?.classList.remove('flex')
                  }}
                />
              )}
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
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
        />
        <LanguageSelector value={tempLanguages} onChange={setTempLanguages} />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button 
          onClick={handleApply}
          variant="contained" 
          disabled={tempName === name && 
            JSON.stringify(tempLanguages) === JSON.stringify(languages) && 
            !selectedFile}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
} 