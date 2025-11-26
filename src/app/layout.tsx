import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import { SessionProvider } from '@/components/providers/SessionProvider'
import ViewportHeightSetter from '@/components/ViewportHeightSetter'
import ClientLoggerConfig from '@/components/ClientLoggerConfig'
import RequestIdInjector from '@/components/RequestIdInjector'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CallMiracle",
  description: "A miracle communication platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CallMiracle",
  },
};

export default async function RootLayout({ children, }: { children: React.ReactNode; }) {
  // const cookieStore = await cookies()
  // const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en'

  const serverId = process.env.SERVER_ID || (process.env.NODE_ENV === 'development' ? 'dev' : 'unknown')

  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <meta name="server-id" content={serverId} />
      </head>
      <body>
        <ViewportHeightSetter />
        <SessionProvider>
          <ClientLoggerConfig />
          <RequestIdInjector />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
} 