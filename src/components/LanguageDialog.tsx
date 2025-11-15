'use client';

import { Dialog, DialogTitle, DialogContent, Button, IconButton } from '@mui/material';
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
      PaperProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white'
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <span>{t('selectInterfaceLanguage')}</span>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <div className="flex flex-col gap-2">
          {locales.map((locale) => (
            <Button
              key={locale}
              variant={currentLocale === locale ? 'contained' : 'outlined'}
              onClick={() => handleLanguageChange(locale)}
              fullWidth
              sx={{
                color: currentLocale === locale ? 'black' : 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                backgroundColor: currentLocale === locale ? 'white' : 'transparent',
                '&:hover': {
                  backgroundColor: currentLocale === locale ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                }
              }}
            >
              {getLanguageName(locale)}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
