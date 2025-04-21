import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ApolloWrapper } from '@/lib/apollo-provider';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import ThemeRegistry from '@/components/ThemeRegistry';
import { AppContent, StoreInitializer } from '@/components/AppContent';
import { cookies } from 'next/headers';

export default async function LocaleLayout({ children, }: { children: React.ReactNode; }) {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en'

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    console.error('Failed to load messages:', error);
    notFound();
  }

  return (
    <AppRouterCacheProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ApolloWrapper>
          <ThemeRegistry>
            <StoreInitializer>
              {children}
            </StoreInitializer>
          </ThemeRegistry>
        </ApolloWrapper>
      </NextIntlClientProvider>
    </AppRouterCacheProvider>
  );
} 