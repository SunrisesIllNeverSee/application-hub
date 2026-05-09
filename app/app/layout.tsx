import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Application Hub',
    template: '%s — Application Hub',
  },
  description:
    'Apply smarter. Build a reusable answer bank, track every program deadline, and get AI-matched to the accelerators and grants that fit your startup.',
  keywords: ['accelerator', 'grants', 'fellowship', 'startup', 'applications', 'YC', 'Techstars'],
  authors: [{ name: 'Ello Cello LLC' }],
  openGraph: {
    type: 'website',
    siteName: 'Application Hub',
    title: 'Application Hub — Apply to accelerators and grants, smarter',
    description:
      'One place to research programs, manage applications, and reuse answers across every program you apply to.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
