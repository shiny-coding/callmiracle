'use client'

import { useState, useRef } from 'react'
import { Button, TextField, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'

type PasswordResetTabProps = {
  onBack: () => void
}

export default function PasswordResetTab({ onBack }: PasswordResetTabProps) {
  const t = useTranslations('Auth')
  const [email, setEmail] = useState('')
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'too-frequently'>('idle')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)

  const validateResetForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (resetStep === 'email') {
      if (!email) newErrors.email = t('fieldRequired')
      if (email && !/\S+@\S+\.\S+/.test(email)) newErrors.email = t('invalidEmail')
    } else {
      if (!resetCode) newErrors.resetCode = t('fieldRequired')
      if (!newPassword) newErrors.newPassword = t('fieldRequired')
      if (!confirmNewPassword) newErrors.confirmNewPassword = t('fieldRequired')
      if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) {
        newErrors.confirmNewPassword = t('passwordsMismatch')
      }
    }
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateResetForm()) return
    setResetStatus('sending')
    setError('')
    try {
      const response = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.text()
      if (result === 'sent') {
        setResetStatus('sent')
        setResetStep('code')
      } else if (result === 'too-frequently') {
        setResetStatus('too-frequently')
        setError(t('resetTooFrequently'))
      } else {
        setResetStatus('error')
        setError(t('resetError'))
      }
    } catch (err) {
      setResetStatus('error')
      setError(t('resetError'))
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateResetForm()) return
    setError('')
    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: resetCode,
          newPassword,
        }),
      })
      const result = await response.text()
      if (result === 'ok') {
        setResetStep('email')
        setResetCode('')
        setNewPassword('')
        setConfirmNewPassword('')
        setError('')
        setEmail('')
        setResetStatus('idle')
        onBack()
      } else {
        setError(t('resetInvalidOrExpired'))
      }
    } catch (err) {
      setError(t('resetError'))
    }
  }

  return (
    <>
      {error && (
        <Typography color="error" className="text-center" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}
      <form
        ref={formRef}
        onSubmit={resetStep === 'email' ? handleSendResetCode : handleResetPassword}
        className="flex flex-col gap-4"
        autoComplete="off"
        noValidate
      >
        <TextField
          label={t('email')}
          type="email"
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            if (validationErrors.email) {
              setValidationErrors({ ...validationErrors, email: '' })
            }
          }}
          fullWidth
          required
          autoComplete="email"
          inputProps={{ name: "email" }}
          error={!!validationErrors.email}
          helperText={validationErrors.email}
          InputLabelProps={{ shrink: true }}
          disabled={resetStep === 'code'}
        />
        {resetStep === 'email' && (
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            className="mt-4"
            disabled={resetStatus === 'sending'}
          >
            {t('sendResetCode')}
          </Button>
        )}
        {resetStep === 'code' && (
          <>
            <TextField
              label={t('resetCode')}
              value={resetCode}
              onChange={e => {
                setResetCode(e.target.value)
                if (validationErrors.resetCode) {
                  setValidationErrors({ ...validationErrors, resetCode: '' })
                }
              }}
              fullWidth
              required
              inputProps={{ name: "reset-code" }}
              error={!!validationErrors.resetCode}
              helperText={validationErrors.resetCode}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('newPassword')}
              type="password"
              value={newPassword}
              onChange={e => {
                setNewPassword(e.target.value)
                if (validationErrors.newPassword) {
                  setValidationErrors({ ...validationErrors, newPassword: '' })
                }
              }}
              fullWidth
              required
              inputProps={{ name: "new-password" }}
              error={!!validationErrors.newPassword}
              helperText={validationErrors.newPassword}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('confirmNewPassword')}
              type="password"
              value={confirmNewPassword}
              onChange={e => {
                setConfirmNewPassword(e.target.value)
                if (validationErrors.confirmNewPassword) {
                  setValidationErrors({ ...validationErrors, confirmNewPassword: '' })
                }
              }}
              fullWidth
              required
              inputProps={{ name: "confirm-new-password" }}
              error={!!validationErrors.confirmNewPassword}
              helperText={validationErrors.confirmNewPassword}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className="mt-4"
            >
              {t('setNewPassword')}
            </Button>
          </>
        )}
        <Button
          variant="text"
          size="small"
          onClick={onBack}
          sx={{ mt: 1 }}
        >
          {t('backToSignIn')}
        </Button>
      </form>
    </>
  )
} 