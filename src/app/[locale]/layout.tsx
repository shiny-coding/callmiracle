import { ApolloClient, ApolloProvider } from '@apollo/client';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ApolloWrapper } from '@/lib/apollo-provider';
 
export function generateStaticParams() {
  console.log('[locale]/layout.tsx - generateStaticParams called');
  return [{ locale: 'en' }, { locale: 'ru' }];
}
 
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {

  const { locale } = await params
  if (!locale) notFound();
  console.log('LocaleLayout', locale);

  let messages;
  try {
    messages = (await import(`../../../messages/${locale}.json`)).default;
  } catch (error) {
    console.error('Failed to load messages:', error);
    notFound();
  }
 
  return (
    <ApolloWrapper>
      <NextIntlClientProvider messages={messages} locale={locale}>
        {children}
      </NextIntlClientProvider>
    </ApolloWrapper>
  );
} 