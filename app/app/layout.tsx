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
    default: 'Application Hub',
    template: '%s — Application Hub',
  },
  description:
    'Apply smarter. Build a reusable answer bank, track every deadline, and get AI-matched to the accelerators, jobs, schools, and grants that fit you.',
  keywords: ['accelerator', 'grants', 'fellowship', 'startup', 'applications', 'YC', 'Techstars'],
  authors: [{ name: 'Ello Cello LLC' }],
  openGraph: {
    type: 'website',
    url: 'https://mos2es.xyz',
    siteName: 'Application Hub',
    title: 'Application Hub — Apply to accelerators and grants, smarter',
    description:
      'Apply smarter. Build a reusable answer bank, track every deadline, and get AI-matched to the accelerators, jobs, schools, and grants that fit you.',
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
