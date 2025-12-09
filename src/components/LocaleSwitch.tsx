'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button, CircularProgress } from '@mui/material'
import Cookies from 'js-cookie'
import { routerPush } from '@/utils/routerHelper'

export default function LocaleSwitch() {
  const router = useRouter()
  const pathname = usePathname()
  const [isChangingLocale, setIsChangingLocale] = useState(false)

  // Extract current locale from pathname (e.g., /en/auth/signin -> 'en')
  const currentLocale = pathname?.split('/')[1] || 'en'

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) return

    setIsChangingLocale(true)

    // Set cookie with 1 year expiry
    Cookies.set('NEXT_LOCALE', newLocale, { expires: 365 })

    // Update the URL to the new locale
    const pathWithoutLocale = pathname?.split('/').slice(2).join('/')
    const newPath = `/${newLocale}/${pathWithoutLocale}`

    routerPush(router, newPath, {
      source: 'locale_switch',
      newLocale,
      pathWithoutLocale
    })
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={currentLocale === 'en' ? 'contained' : 'outlined'}
        size="small"
        onClick={() => handleLocaleChange('en')}
        disabled={isChangingLocale}
        sx={{
          minWidth: '50px',
          padding: '4px 8px',
          fontSize: '0.875rem',
          textTransform: 'none'
        }}
      >
        {isChangingLocale && currentLocale !== 'en' ? (
          <CircularProgress size={16} sx={{ color: 'inherit' }} />
        ) : (
          'EN'
        )}
      </Button>
      <Button
        variant={currentLocale === 'ru' ? 'contained' : 'outlined'}
        size="small"
        onClick={() => handleLocaleChange('ru')}
        disabled={isChangingLocale}
        sx={{
          minWidth: '50px',
          padding: '4px 8px',
          fontSize: '0.875rem',
          textTransform: 'none'
        }}
      >
        {isChangingLocale && currentLocale !== 'ru' ? (
          <CircularProgress size={16} sx={{ color: 'inherit' }} />
        ) : (
          'RU'
        )}
      </Button>
    </div>
  )
}
