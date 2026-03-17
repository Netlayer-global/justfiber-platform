import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JustFiber Admin Console',
  description: 'Premium ISP Admin Panel for Operations & Support',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    userScalable: false,
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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
