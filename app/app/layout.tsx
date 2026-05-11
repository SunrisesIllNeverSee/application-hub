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
    'One answer bank for every application you write. Built deep on tech startup applications first; jobs, schools, and grants run on the same engine. Switch modes to apply to anything.',
  keywords: [
    'accelerator',
    'grants',
    'fellowship',
    'startup',
    'applications',
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
    siteName: 'Application Hub',
    title: 'Application Hub — Apply to startups, jobs, schools, and grants, smarter',
    description:
      'One answer bank for every application you write. Built deep on tech startup applications first; jobs, schools, and grants run on the same engine. Switch modes to apply to anything.',
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
