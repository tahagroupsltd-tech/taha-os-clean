// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Taha Media OS',
    template: '%s · Taha Media OS',
  },
  description: 'Internal operations platform for Taha Media',
  // Internal tool — keep out of search engines
  robots: { index: false, follow: false },
  // Prevent phone-number linkification on iOS
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fafaf9', // stone-50
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-stone-50 text-stone-900`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-inter)',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid #e7e5e4',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            },
          }}
        />
      </body>
    </html>
  )
}
