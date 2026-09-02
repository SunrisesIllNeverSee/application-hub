import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { PostHogProvider } from '@/components/PostHogProvider'

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
  other: {
    'ai-catalog': '/.well-known/agent.json',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
        {/* Google Analytics 4 (gtag.js) — measurement ID G-WEKMTD1CBL (mos2es.xyz stream) */}
        <Script
          id="ga4-gtag-src"
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-WEKMTD1CBL"
        />
        <Script
          id="ga4-gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-WEKMTD1CBL');`,
          }}
        />
      </body>
    </html>
  )
}
