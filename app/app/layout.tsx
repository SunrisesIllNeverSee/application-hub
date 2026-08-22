import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://mos2es.xyz'),
  title: {
    default: 'AQUA Application Hub',
    template: '%s — AQUA',
  },
  description:
    'AQUA Application Hub turns recurring application questions, reusable answers, fit signals, and review history into a portable application graph.',
  keywords: [
    'AQUA Application Hub',
    'AQUA',
    'application answer bank',
    'application infrastructure',
    'accelerator applications',
    'grant applications',
    'fellowship applications',
    'startup applications',
    'job applications',
    'school applications',
  ],
  authors: [{ name: 'Ello Cello LLC' }],
  openGraph: {
    type: 'website',
    url: 'https://mos2es.xyz',
    siteName: 'AQUA Application Hub',
    title: 'AQUA Application Hub — Applications. Questions. Answers.',
    description:
      'Build a reusable answer bank, preserve source lineage, and understand opportunity fit across applications.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
