import type { Metadata } from 'next'

// Auth pages should not be indexed — they redirect to /login and cause
// "Duplicate without user-selected canonical" errors in Google Search Console
// when multiple auth-protected routes all resolve here.
export const metadata: Metadata = {
  title: 'Sign in — AQUA Application Hub',
  description: 'Sign in to AQUA Application Hub.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/login' },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
