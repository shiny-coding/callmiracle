'use client'

import { signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { routerPush } from '@/utils/routerHelper'

export default function SignOut() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('Auth')

  useEffect(() => {
    // Automatically sign out when the page loads
    const handleSignOut = async () => {
      await signOut({ redirect: false })
      // Extract locale from pathname and redirect to localized signin
      const locale = pathname.split('/')[1] || 'en'
      routerPush(router, `/${locale}/auth/signin`, {
        source: 'auth_signout_page',
        locale,
        previousPath: pathname
      })
    }
    
    handleSignOut()
  }, [router, pathname])

  // Show a simple loading message while signing out
  return (
    <div className="flex justify-center items-center min-h-screen bg-black-100">
      <p>{t('signingOut')}</p>
    </div>
  )
} 