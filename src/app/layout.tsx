import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import { ThemeProvider } from '@/components/ThemeProvider'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { cookies } from 'next/headers'
import ViewportHeightSetter from '@/components/ViewportHeightSetter'

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

  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="dark:text-gray-100">
        <ViewportHeightSetter />
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
} 