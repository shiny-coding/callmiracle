'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef } from 'react'
import Cookies from 'js-cookie'
import { 
  Button, TextField, Typography, Card, CardContent, Divider, Box, 
  Tabs, Tab, FormControl, FormLabel, RadioGroup, FormControlLabel, 
  Radio, Select, MenuItem, InputLabel, Tooltip, IconButton, FormHelperText
} from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import AppleIcon from '@mui/icons-material/Apple'
import InfoIcon from '@mui/icons-material/Info'
import { getBrowserLanguage } from '@/utils/language'
import LocaleSelector from '@/components/LocaleSelector'
import { useTranslations } from 'next-intl'
import PasswordResetTab from '@/components/PasswordResetTab'

export default function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/'
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<'signin' | 'register' | 'password-reset'>('signin')
  const t = useTranslations('Auth')
  const formRef = useRef<HTMLFormElement>(null)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    // Check required fields
    if (!email) newErrors.email = t('fieldRequired')
    if (!password) newErrors.password = t('fieldRequired')
    
    if (mode === 'register') {
      if (!name) newErrors.name = t('fieldRequired')
      if (!confirmPassword) newErrors.confirmPassword = t('fieldRequired')
      else if (password !== confirmPassword) newErrors.confirmPassword = t('passwordsMismatch')
    }
    
    // Validate email format
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('invalidEmail')
    }
    
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    if (mode === 'signin') {
      try {
        const res = await signIn('credentials', { redirect: false, email, password, callbackUrl, })

        if (!res?.error) {
          router.push(callbackUrl)
        } else if (res.error.startsWith('provider_')) {
          // Handle provider error
          const provider = res.error.replace('provider_', '')
          const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)
          setError(t('socialAccountExists', { provider: providerName }))
        } else {
          setError(t('invalidCredentials'))
        }
      } catch (error) {
        console.error('Sign in error:', error)
        setError(t('somethingWentWrong'))
      }
    } else {
      // Registration logic
      if (password !== confirmPassword) {
        setError(t('passwordsMismatch'))
        return
      }
      
      try {
        const defaultLanguages = getBrowserLanguage()
        // Send registration request to your API
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, defaultLanguages }),
        })

        const data = await response.json()

        if (response.ok) {
          // Sign in the user after successful registration
          await signIn('credentials', {
            redirect: false,
            email,
            password,
          })
          router.push(callbackUrl)
        } else if (data.error === 'provider_exists') {
          // Handle case where email is already used with a social provider
          const provider = data.provider.charAt(0).toUpperCase() + data.provider.slice(1)
          setError(t('socialAccountExists', { provider }))
        } else {
          setError(data.message || t('registrationFailed'))
        }
      } catch (error) {
        console.error('Registration error:', error)
        setError(t('registrationError'))
      }
    }
  }

  const handleSignIn = (provider: string) => {
    // Initiate Google Sign-In
    signIn(provider, { callbackUrl })
  }

  return (
    <div
      className="flex justify-center items-center"
      style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}
    >
      <Card className="w-full max-w-md p-4">
        <CardContent>
          <div className="flex justify-between mb-4">
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setMode('password-reset')
                setError('')
                setValidationErrors({})
              }}
              sx={{ minWidth: 0, padding: 0, textTransform: 'none' }}
              disabled={mode === 'password-reset'}
            >
              {t('forgotPassword')}
            </Button>
            <LocaleSelector />
          </div>
          {mode !== 'password-reset' && (
            <>
              <Tabs 
                value={mode} 
                onChange={(_, newValue) => {
                  setMode(newValue)
                  setError('')
                  setValidationErrors({})
                }}
                variant="fullWidth"
                className="mb-6"
              >
                <Tab value="signin" label={t('signIn')} />
                <Tab value="register" label={t('register')} />
              </Tabs>
            </>
          )}
          
          {error && (
            <Typography color="error" className="text-center" sx={{ mb: 1 }}>
              {error}
            </Typography>
          )}
          
          {mode === 'password-reset' ? (
            <PasswordResetTab
              onBack={() => {
                setMode('signin')
                setError('')
                setValidationErrors({})
              }}
            />
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off" noValidate>
              {mode === 'register' && (
                <>
                  <TextField
                    label={t('nameNickname')}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (validationErrors.name) {
                        setValidationErrors({...validationErrors, name: ''})
                      }
                    }}
                    fullWidth
                    required
                    autoComplete="name"
                    inputProps={{ name: "name" }}
                    error={!!validationErrors.name}
                    helperText={validationErrors.name}
                    InputLabelProps={{ shrink: true }}
                  />
                </>
              )}
              
              <TextField
                label={t('email')}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (validationErrors.email) {
                    setValidationErrors({...validationErrors, email: ''})
                  }
                }}
                fullWidth
                required
                autoComplete="email"
                inputProps={{ name: "email" }}
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                InputLabelProps={{ shrink: true }}
              />
              
              <TextField
                label={t('password')}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (validationErrors.password) {
                    setValidationErrors({...validationErrors, password: ''})
                  }
                }}
                fullWidth
                required
                autoComplete={mode === 'register' ? "new-password" : "current-password"}
                inputProps={{ name: mode === 'register' ? "new-password" : "current-password" }}
                error={!!validationErrors.password}
                helperText={validationErrors.password}
                InputLabelProps={{ shrink: true }}
              />
              
              {mode === 'register' && (
                <TextField
                  label={t('confirmPassword')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (validationErrors.confirmPassword) {
                      setValidationErrors({...validationErrors, confirmPassword: ''})
                    }
                  }}
                  fullWidth
                  required
                  autoComplete="new-password"
                  inputProps={{ name: "new-password-confirm" }}
                  error={!!validationErrors.confirmPassword}
                  helperText={validationErrors.confirmPassword}
                  InputLabelProps={{ shrink: true }}
                />
              )}
              
              <Button 
                type="submit" 
                variant="contained" 
                color="primary" 
                fullWidth
                className="mt-4"
              >
                {mode === 'signin' ? t('signIn') : t('register')}
              </Button>
            </form>
          )}
          
          {mode !== 'password-reset' && (
            <>
              <Divider className="" sx={{ my: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('or')}
                </Typography>
              </Divider>
              <Box className="flex flex-col gap-3">
                <Button
                  variant="outlined"
                  startIcon={<GoogleIcon />}
                  onClick={() => handleSignIn('google')}
                  fullWidth
                >
                  {mode === 'signin' ? t('signInWithGoogle') : t('registerWithGoogle')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AppleIcon />}
                  onClick={() => handleSignIn('apple')}
                  fullWidth
                >
                  {mode === 'signin' ? t('signInWithApple') : t('registerWithApple')}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 