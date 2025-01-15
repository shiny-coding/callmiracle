'use client';

import { usePathname, useRouter } from 'next/navigation';
import { FormControl, Select, MenuItem } from '@mui/material';
import { Locale, locales } from '@/config';
import Cookies from 'js-cookie'

export default function LocaleSelector() {
  const pathname = usePathname();
  const router = useRouter();

  // Get the most specific matching locale from browser
  const getDefaultLocale = (): string => {
    const browserLangs = navigator.languages || [navigator.language];
    
    // Try exact matches first (e.g., 'ru-RU' matches 'ru')
    for (const lang of browserLangs) {
      const langCode = lang.toLowerCase().split('-')[0];
      if (locales.includes(langCode as Locale)) {
        return langCode;
      }
    }
    
    return 'en'; // Fallback to English if no matches
  };

  // Use the current URL locale or detect from browser
  const currentLocale = pathname.split('/')[1] || getDefaultLocale();

  const handleChange = (newLocale: string) => {
    // Set cookie with 1 year expiry
    Cookies.set('NEXT_LOCALE', newLocale, { expires: 365 })
    
    const pathWithoutLocale = pathname.split('/').slice(2).join('/')
    const newPath = `/${newLocale}/${pathWithoutLocale}`
    router.push(newPath)
  };

  return (
    <div className="absolute top-4 right-4">
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <Select
          value={currentLocale}
          onChange={(e) => handleChange(e.target.value)}
          variant="outlined"
        >
          {locales.map((locale) => (
            <MenuItem key={locale} value={locale}>
              {locale.toUpperCase()}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
} 