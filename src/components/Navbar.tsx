'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button, AppBar, Toolbar, Typography, Avatar } from '@mui/material'
import Link from 'next/link'

export default function Navbar() {
  const { session, isAuthenticated, signOut } = useAuth()
  
  return (
    <AppBar position="static">
      <Toolbar className="justify-between">
        <Typography variant="h6" component="div">
          Your App
        </Typography>
        
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2">
                <Avatar src={session?.user?.image || undefined} alt={session?.user?.name || ''}>
                  {session?.user?.name?.[0]}
                </Avatar>
                <Typography>{session?.user?.name}</Typography>
              </div>
              <Button color="inherit" onClick={() => signOut()}>
                Logout
              </Button>
            </>
          ) : (
            <Button color="inherit" component={Link} href="/auth/signin">
              Login
            </Button>
          )}
        </div>
      </Toolbar>
    </AppBar>
  )
} 