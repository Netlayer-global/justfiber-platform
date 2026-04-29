import type { Metadata, Viewport } from 'next'
import { Open_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import 'leaflet/dist/leaflet.css'
import './globals.css'

const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'JustFiber Admin',
  description: 'ISP Admin Operations Console',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${openSans.variable} font-sans text-slate-900`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
