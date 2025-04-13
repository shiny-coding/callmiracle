'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

export default function SignOut() {
  const router = useRouter()
  const t = useTranslations('Auth')

  useEffect(() => {
    // Automatically sign out when the page loads
    const handleSignOut = async () => {
      await signOut({ redirect: false })
      router.push('/auth/signin')
    }
    
    handleSignOut()
  }, [router])

  // Show a simple loading message while signing out
  return (
    <div className="flex justify-center items-center min-h-screen bg-black-100">
      <p>{t('signingOut')}</p>
    </div>
  )
} 