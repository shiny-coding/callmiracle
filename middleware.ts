import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/config';

// Function to get best matching locale from Accept-Language header
function getLocaleFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return defaultLocale;
  
  // Parse Accept-Language header values and their q-factors
  const languages = acceptLanguage.split(',')
    .map(lang => {
      const [code, q = '1'] = lang.split(';q=');
      return {
        code: code.split('-')[0], // Get primary language code
        q: parseFloat(q)
      };
    })
    .sort((a, b) => b.q - a.q); // Sort by q-factor

  // Find first matching locale
  for (const lang of languages) {
    if (locales.includes(lang.code as any)) {
      return lang.code;
    }
  }

  return defaultLocale;
}

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true
});

export const config = {
  matcher: ['/', '/(ru|en)/:path*']
}; 