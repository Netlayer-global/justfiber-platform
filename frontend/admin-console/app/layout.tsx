import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })
const geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'JustFiber Admin Console',
  description: 'Premium ISP Admin Panel for Operations & Support',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    userScalable: false,
    themeColor: '#0f1419',
  },
  icons: {
    icon: '/favicon.ico',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={geist.className}>
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
