import { Dialog, DialogTitle, DialogContent, TextField, IconButton, DialogActions, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import { useCallback, useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import LanguageSelector from './LanguageSelector'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { Dialog as CameraDialog } from '@mui/material'

interface ProfileSettingsProps {
  open: boolean
  onClose: () => void
}

export default function ProfileSettings({ open, onClose }: ProfileSettingsProps) {
  const t = useTranslations('Profile')
  const { name, setName, languages, setLanguages, hasImage, setHasImage, localVideoEnabled } = useStore()
  const [tempName, setTempName] = useState(name)
  const [tempLanguages, setTempLanguages] = useState(languages)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [timestamp, setTimestamp] = useState(Date.now())
  const userId = getUserId()
  const { updateUserData } = useUpdateUser()
  const { localStream } = useWebRTCContext()
  const [showCameraPreview, setShowCameraPreview] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (open) {
      setTempName(name)
      setTempLanguages(languages)
      setSelectedFile(null)
      setTimestamp(Date.now())
    }
    return () => {
      setShowCameraPreview(false)
    }
  }, [open, name, languages])

  const onCameraDialogReady = () => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream
      videoRef.current.play().catch(err => console.error('Error playing video:', err))
    }
  }


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

  const handleCameraCapture = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' })
        setSelectedFile(file)
        setShowCameraPreview(false)
      }
    }, 'image/jpeg')
  }

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
        <div className="relative">
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

          <div className="absolute bottom-2 right-2 flex gap-2">
            <IconButton 
              onClick={(e) => {
                e.stopPropagation()
                setShowCameraPreview(true)
              }}
              className="bg-black/50 hover:bg-black/70"
              disabled={!localStream}
            >
              <PhotoCameraIcon className="text-white" />
            </IconButton>
          </div>
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

      <CameraDialog
        open={showCameraPreview}
        onClose={() => setShowCameraPreview(false)}
        TransitionProps={{
          onEntered: onCameraDialogReady
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle className="flex justify-between items-center">
          {t('takePhoto')}
          <IconButton onClick={() => setShowCameraPreview(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent className="flex flex-col gap-4">
          <div className="relative aspect-square w-full max-w-[240px] mx-auto overflow-hidden rounded-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </DialogContent>
        <DialogActions className="border-t border-gray-800">
          <Button onClick={() => setShowCameraPreview(false)}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleCameraCapture}
            variant="contained"
          >
            {t('takePhoto')}
          </Button>
        </DialogActions>
      </CameraDialog>
    </Dialog>
  )
} 