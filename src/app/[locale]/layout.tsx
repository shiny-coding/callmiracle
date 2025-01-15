import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ApolloWrapper } from '@/lib/apollo-provider';
import LanguageSelector from '@/components/LanguageSelector';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import LocaleSelector from '@/components/LocaleSelector';

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
    <ApolloWrapper>
      <AppRouterCacheProvider>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <LocaleSelector />
          {children}
        </NextIntlClientProvider>
      </AppRouterCacheProvider>
    </ApolloWrapper>
  );
} 