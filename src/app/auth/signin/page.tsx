'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button, TextField, Typography, Card, CardContent, Divider, Box } from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import AppleIcon from '@mui/icons-material/Apple'

export default function SignIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const res = await signIn('credentials', {
        redirect: false,
        username,
        password,
        callbackUrl,
      })

      if (!res?.error) {
        router.push(callbackUrl)
      } else {
        setError('Invalid username or password')
      }
    } catch (error) {
      console.error('Sign in error:', error)
      setError('Something went wrong')
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-4">
        <CardContent>
          <Typography variant="h5" className="text-center mb-6">
            Sign In
          </Typography>
          
          {error && (
            <Typography color="error" className="mb-4 text-center">
              {error}
            </Typography>
          )}
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              fullWidth
              className="mt-2"
            >
              Sign In
            </Button>
          </form>
          
          <Divider className="my-6">
            <Typography variant="body2" color="textSecondary">
              OR
            </Typography>
          </Divider>
          
          <Box className="flex flex-col gap-3">
            <Button
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={() => signIn('google', { callbackUrl })}
              fullWidth
            >
              Sign in with Google
            </Button>
            <Button
              variant="outlined"
              startIcon={<AppleIcon />}
              onClick={() => signIn('apple', { callbackUrl })}
              fullWidth
            >
              Sign in with Apple
            </Button>
          </Box>
        </CardContent>
      </Card>
    </div>
  )
} 