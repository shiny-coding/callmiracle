'use client';

import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Locale, locales } from '@/config';
import Cookies from 'js-cookie';
import { routerPush } from '@/utils/routerHelper';

interface LanguageDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function LanguageDialog({ open, onClose }: LanguageDialogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();

  const getDefaultLocale = (): string => {
    const browserLangs = navigator.languages || [navigator.language];

    for (const lang of browserLangs) {
      const langCode = lang.toLowerCase().split('-')[0];
      if (locales.includes(langCode as Locale)) {
        return langCode;
      }
    }

    return 'en';
  };

  const currentLocale = pathname?.split('/')[1] || getDefaultLocale();

  const handleLanguageChange = async (newLocale: string) => {
    Cookies.set('NEXT_LOCALE', newLocale, { expires: 365 });

    try {
      await fetch('/api/update-locale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch (error) {
      console.error('Failed to update locale on server:', error);
    }

    const pathWithoutLocale = pathname?.split('/').slice(2).join('/');
    const newPath = `/${newLocale}/${pathWithoutLocale}`;

    onClose();

    routerPush(router, newPath, {
      source: 'language_dialog_change',
      oldLocale: currentLocale,
      newLocale,
      pathWithoutLocale
    });
  };

  const getLanguageName = (locale: string): string => {
    switch (locale) {
      case 'en':
        return t('Languages.english');
      case 'ru':
        return t('Languages.russian');
      default:
        return locale.toUpperCase();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>{t('selectInterfaceLanguage')}</span>
        <IconButton
          onClick={onClose}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <div className="flex flex-col gap-2">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleLanguageChange(locale)}
              className={`
                px-4 py-3 rounded text-sm text-left transition-colors border
                ${currentLocale === locale
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-transparent text-color border-blue-500 hover:bg-blue-500/10'
                }
              `}
            >
              {getLanguageName(locale)}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
