'use client'

import { Dialog, DialogTitle, DialogContent, TextField, IconButton, DialogActions, Button, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Select, MenuItem, Paper } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonIcon from '@mui/icons-material/Person'
import { useTranslations } from 'next-intl'
import { useCallback, useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import { useStore } from '@/store/useStore'
import LanguageSelector from './LanguageSelector'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { Dialog as CameraDialog } from '@mui/material'
import { signOut } from 'next-auth/react'
import { useProfileImage } from '@/hooks/useProfileImage'
import { gql, useMutation } from '@apollo/client'
import { useRouter } from 'next/navigation'
import CircularProgress from '@mui/material/CircularProgress'
import PageHeader from './PageHeader'
import { routerPush } from '@/utils/routerHelper'
import Typography from '@mui/material/Typography'
import { useServer } from '@/contexts/ServerContext'

const DELETE_USER = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId)
  }
`

export default function ProfileForm() {
  const t = useTranslations('Profile')
  const tRoot = useTranslations()
  const { currentUser, setCurrentUser } = useStore( (state: any) => ({
    currentUser: state.currentUser,
    setCurrentUser: state.setCurrentUser
  }))
  const { name = '', languages = [], about = '', contacts = '', sex = null, birthYear = null } = currentUser || {}
  const [tempName, setTempName] = useState(name)
  const [tempLanguages, setTempLanguages] = useState(languages)
  const [tempAbout, setTempAbout] = useState(about)
  const [tempContacts, setTempContacts] = useState(contacts)
  const [tempSex, setTempSex] = useState<string | null>(sex)
  const [tempBirthYear, setTempBirthYear] = useState<number | null>(birthYear)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [timestamp, setTimestamp] = useState(Date.now())
  const { updateUserData } = useUpdateUser()
  const { localStream } = useWebRTCContext()
  const { serverId, preferredServerId, setPreferredServerId, availableServers } = useServer()
  const [showCameraPreview, setShowCameraPreview] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const currentUserId = currentUser?._id || ''
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [imageDeleted, setImageDeleted] = useState(false)
  const [deleteUser] = useMutation(DELETE_USER)
  const router = useRouter()
  const { imageSrc: existingImageSrc } = useProfileImage(currentUserId, timestamp)

  useEffect(() => {
    setTempName(name)
    setTempLanguages(languages)
    setTempAbout(about)
    setTempContacts(contacts)
    setTempSex(sex)
    setTempBirthYear(birthYear)
    setSelectedFile(null)
    setImageDeleted(false)
    setTimestamp(Date.now())
    return () => {
      setShowCameraPreview(false)
    }
  }, [name, languages, about, contacts, sex, birthYear])

  const onCameraDialogReady = () => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream
      videoRef.current.play().catch(err => console.error('Error playing video:', err))
    }
  }

  function onClose() {
    if (window.history.length > 1) {
      router.back()
    } else {
      routerPush(router, '/', {
        source: 'profile_form_cancel_fallback',
        reason: 'no_browser_history'
      })
    }
  }


  const handleCancel = () => {
    setTempName(name)
    setTempLanguages(languages)
    setTempAbout(about)
    setTempContacts(contacts)
    setTempSex(sex)
    setTempBirthYear(birthYear)
    setSelectedFile(null)
    setImageDeleted(false)
    onClose()
  }

  const handleApply = async () => {
    setUploading(true)
    try {
      // Handle photo deletion first
      if (imageDeleted) {
        await fetch('/api/delete-photo', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: currentUserId }),
        })
        // Force re-check of image existence after deletion
        setTimestamp(Date.now())
      }
      
      // Handle photo upload
      if (selectedFile) {
        const formData = new FormData()
        formData.append('photo', selectedFile)
        formData.append('userId', currentUserId)
        
        await fetch('/api/upload-photo', {
          method: 'POST',
          body: formData
        })
      }

      setCurrentUser({
        ...currentUser!,
        name: tempName,
        languages: tempLanguages,
        about: tempAbout,
        contacts: tempContacts,
        sex: tempSex || '',
        birthYear: tempBirthYear
      })
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
    setImageDeleted(false)
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
        setImageDeleted(false)
        setShowCameraPreview(false)
      }
    }, 'image/jpeg')
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 80 }, (_, i) => currentYear - i - 10)

  const handleDeleteAccount = async () => {
    try {
      await deleteUser({ variables: { userId: currentUserId } })
      signOut({ redirect: false }).then(() => {
        routerPush(router, '/auth/signin', {
          source: 'profile_form_delete_account',
          reason: 'account_deleted'
        })
      })
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  const handleDeletePhoto = () => {
    setImageDeleted(true)
  }

  return (
    <Paper className="flex flex-col h-full relative">
      {/* Loader Overlay */}
      {uploading && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60"
          style={{ pointerEvents: 'all' }}
        >
          <CircularProgress color="inherit" />
        </div>
      )}
      {/* Header */}
      <PageHeader icon={<PersonIcon />} title={t('title')}>
        <IconButton
          onClick={handleCancel}
          size="small"
          aria-label={t('close')}
          title={t('close')}
          className="icon-gradient"
        >
          <CloseIcon />
        </IconButton>
      </PageHeader>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        <div className="relative flex justify-center items-center">
          <div
            {...getRootProps()}
            className="w-full aspect-square max-w-[240px] mx-auto rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-colors"
            style={{ borderColor: 'var(--icon-color-primary)' }}
          >
            <input {...getInputProps()} />
            {currentUserId ? (
              <div className="relative w-full h-full">
                {(selectedFile || (existingImageSrc && !imageDeleted)) ? (
                  <Image
                    src={selectedFile ? URL.createObjectURL(selectedFile) : existingImageSrc!}
                    alt={t('photo')}
                    fill
                    unoptimized
                    className="object-cover rounded-full"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    {uploading ? t('uploading') : t('uploadPhoto')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">
                {uploading ? t('uploading') : t('uploadPhoto')}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                setShowCameraPreview(true)
              }}
              className="icon-gradient"
              disabled={!localStream}
            >
              <PhotoCameraIcon />
            </IconButton>
            {(selectedFile || (existingImageSrc && !imageDeleted)) && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeletePhoto()
                }}
                className="icon-gradient"
              >
                <DeleteIcon />
              </IconButton>
            )}
          </div>
        </div>

        <TextField
          label={t('name')}
          fullWidth
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
        />
        <TextField
          label={t('about')}
          fullWidth
          multiline
          minRows={2}
          maxRows={Math.floor(window.innerHeight * 0.5 / 24)}
          value={tempAbout}
          onChange={(e) => setTempAbout(e.target.value)}
          className="resize-none"
        />
        <TextField
          label={t('contacts')}
          fullWidth
          multiline
          minRows={2}
          maxRows={Math.floor(window.innerHeight * 0.5 / 24)}
          value={tempContacts}
          onChange={(e) => setTempContacts(e.target.value)}
          className="resize-none"
        />
        <LanguageSelector
          value={tempLanguages}
          onChange={setTempLanguages}
          label={t('iSpeak')}
          showQuickSelectors={true}
        />
        <FormControl>
          <FormLabel id="sex-radio-group">{t('sex')}</FormLabel>
          <RadioGroup
            row
            value={tempSex || ''}
            onChange={(e) => setTempSex(e.target.value)}
          >
            <FormControlLabel 
              value="female" 
              control={<Radio />} 
              label={t('female')} 
            />
            <FormControlLabel 
              value="male" 
              control={<Radio />} 
              label={t('male')} 
            />
          </RadioGroup>
        </FormControl>

        <FormControl fullWidth>
          <FormLabel id="birth-year-select">{t('birthYear')}</FormLabel>
          <Select
            value={tempBirthYear || ''}
            onChange={(e) => setTempBirthYear(Number(e.target.value) || null)}
            displayEmpty
          >
            <MenuItem value="">{t('selectYear')}</MenuItem>
            {years.map(year => (
              <MenuItem key={year} value={year}>{year}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Show server selection only for multi-server deployments */}
        {availableServers.length > 1 && (
          <FormControl fullWidth>
            <FormLabel id="server-select">{t('preferredServer')}</FormLabel>
            <Select
              value={preferredServerId || 'auto'}
              onChange={(e) => setPreferredServerId(e.target.value === 'auto' ? null : e.target.value)}
              displayEmpty
            >
              {availableServers.map(server => (
                <MenuItem key={server} value={server}>
                  {server === 'auto' ? t('serverAuto') : `${t('server')} ${server}`}
                  {serverId === server && server !== 'auto' && ' (current)'}
                </MenuItem>
              ))}
            </Select>
            {serverId && (
              <Typography variant="caption" color="text.secondary" className="mt-1">
                {t('currentlyConnectedTo')}: {serverId === 'unknown' ? t('unknown') : `${t('server')} ${serverId}`}
              </Typography>
            )}
          </FormControl>
        )}

        <div className="mt-4 pt-4 border-t panel-border">
          <Button 
            onClick={() => setShowDeleteConfirmation(true)}
            color="error"
            startIcon={<DeleteIcon />}
            size="small"
          >
            {t('deleteAccount')}
          </Button>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="sticky bottom-0 left-0 w-full border-t panel-border px-4 py-3 flex justify-end gap-2 z-10">
        <div className="flex flex-col justify-start gap-2 mr-auto">
          {tempLanguages.length === 0 && (
            <Typography color="warning" className="text-sm">
              {tRoot('pleaseSelectLanguages')}
            </Typography>
          )}
        </div>
        <Button onClick={handleCancel}>{t('cancel')}</Button>
        <Button 
          onClick={handleApply}
          variant="contained" 
          disabled={
            (tempName === name && 
            JSON.stringify(tempLanguages) === JSON.stringify(languages) && 
            tempAbout === about &&
            tempContacts === contacts &&
            tempSex === sex &&
            tempBirthYear === birthYear &&
            !selectedFile &&
            !imageDeleted) ||
            tempLanguages.length === 0
          }
        >
          {tRoot('apply')}
        </Button>
      </div>

      {/* Camera Dialog (can be kept as a modal if needed, or refactored inline) */}
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
          <div className="relative aspect-square w-full max-w-[240px] mx-auto overflow-hidden rounded-full">
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
            {tRoot('cancel')}
          </Button>
          <Button 
            onClick={handleCameraCapture}
            variant="contained"
          >
            {t('takePhoto')}
          </Button>
        </DialogActions>
      </CameraDialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('deleteAccountConfirmTitle')}</DialogTitle>
        <DialogContent>
          <p>{t('deleteAccountConfirmMessage')}</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirmation(false)}>
            {tRoot('cancel')}
          </Button>
          <Button
            onClick={handleDeleteAccount}
            variant="contained"
            color="error"
          >
            {t('deleteAccount')}
          </Button>
        </DialogActions>
      </Dialog>


    </Paper>
  )
} 