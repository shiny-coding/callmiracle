import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ApolloWrapper } from '@/lib/apollo-provider';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import LocaleSelector from '@/components/LocaleSelector';
import { StoreInitializer } from '@/components/StoreInitializer';
import { WebRTCProvider } from '@/hooks/webrtc/WebRTCProvider';
import { UsersProvider } from '@/store/UsersProvider';
import ThemeRegistry from '@/components/ThemeRegistry';

export default async function LocaleLayout({
  children,
  params: paramsPromise,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const params = await paramsPromise;
  const { locale } = params;
  if (!locale) notFound();

  let messages;
  try {
    messages = (await import(`../../../messages/${locale}.json`)).default;
  } catch (error) {
    console.error('Failed to load messages:', error);
    notFound();
  }

  return (
    <AppRouterCacheProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ApolloWrapper>
          <ThemeRegistry>
            <UsersProvider>
              <StoreInitializer />
              {/* <LocaleSelector /> */}
              {children}
            </UsersProvider>
          </ThemeRegistry>
        </ApolloWrapper>
      </NextIntlClientProvider>
    </AppRouterCacheProvider>
  );
} 