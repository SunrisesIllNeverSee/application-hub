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
    default: 'AQUA',
    template: '%s — AQUA',
  },
  description:
    'Applications. Questions. Answers. A structured intelligence system for reusable applications. Fill once, improve continuously, apply everywhere.',
  keywords: [
    'applications',
    'questions',
    'answers',
    'accelerator',
    'grants',
    'fellowship',
    'startup',
    'YC',
    'Techstars',
    'job applications',
    'school applications',
    'common app',
    'NSF',
    'NIH',
    'university applications',
    'graduate school',
  ],
  authors: [{ name: 'Ello Cello LLC' }],
  openGraph: {
    type: 'website',
    url: 'https://mos2es.xyz',
    siteName: 'AQUA',
    title: 'AQUA — Applications. Questions. Answers.',
    description:
      'Applications. Questions. Answers. A structured intelligence system for reusable applications. Fill once, improve continuously, apply everywhere.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
