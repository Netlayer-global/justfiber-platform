import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import 'leaflet/dist/leaflet.css'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'JustFiber Admin',
  description: 'ISP Admin Operations Console',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} font-sans bg-[#0a0e27] text-[#f0f4f8]`}>
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  )
}
