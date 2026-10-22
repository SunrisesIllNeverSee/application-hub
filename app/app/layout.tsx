import type { Metadata } from 'next'
import Script from 'next/script'
import { EARLY_URL_STRIP_SCRIPT, GA4_QUERYLESS_ROUTE_RE } from '@/lib/url-privacy'
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
  metadataBase: new URL('https://aquaidp.xyz'),
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
    url: 'https://aquaidp.xyz',
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
      <head>
        {/* M09 hardening M5: move ?url= into the fragment BEFORE any analytics runs (middleware does the same server-side). */}
        <script id="aqua-url-strip" dangerouslySetInnerHTML={{ __html: EARLY_URL_STRIP_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
        {/* Google Analytics 4 (gtag.js) — measurement ID G-WEKMTD1CBL (aquaidp.xyz stream) */}
        <Script
          id="ga4-gtag-src"
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-WEKMTD1CBL"
        />
        <Script
          id="ga4-gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            // M09 hardening M5: on /apply and /review the page_location is
            // origin + path only (no query, no fragment) — a deep-linked
            // application URL must never reach GA4.
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());var aquaCfg={};if(${GA4_QUERYLESS_ROUTE_RE.toString()}.test(location.pathname)||/(^#|&)url=/.test(location.hash)){aquaCfg.page_location=location.origin+location.pathname;}gtag('config','G-WEKMTD1CBL',aquaCfg);`,
          }}
        />
        {/* WebMCP bridge — exposes browser-native tools for AI agents */}
        <Script
          id="webmcp-bridge"
          strategy="afterInteractive"
          src="/webmcp.js"
        />
      </body>
    </html>
  )
}
