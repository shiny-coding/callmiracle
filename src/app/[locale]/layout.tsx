import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ApolloWrapper } from '@/lib/apollo-provider';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import ThemeRegistry from '@/components/ThemeRegistry';
import {StoreInitializer } from '@/components/AppContent';
import { ClientLayout } from './ClientLayout';
import { locales } from '@/config';

// Generate static params for all locales
export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export default async function LocaleLayout({ 
  children, 
  params 
}: { 
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

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
              <ClientLayout>
                {children}
              </ClientLayout>
            </StoreInitializer>
          </ThemeRegistry>
        </ApolloWrapper>
      </NextIntlClientProvider>
    </AppRouterCacheProvider>
  );
} 

