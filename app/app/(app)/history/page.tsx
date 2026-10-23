import { notFound } from 'next/navigation'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import { HistoryConfirm } from '@/components/history/HistoryConfirm'

// M09b — "Confirm submitted history" (protected: middleware PROTECTED_ROUTES
// + the (app) layout's auth gate). The records live only in the browser
// vault; this page ships no data. 404s unless local-first is enabled.
export const metadata = { title: 'Confirm submitted history', robots: { index: false, follow: false } }

export default function HistoryPage() {
  // Same effective flag as every client gate (NEXT_PUBLIC_AQUA_LOCAL_FIRST,
  // fail-closed in production builds — lib/aqua-local-client/flag.ts).
  if (!LOCAL_FIRST) notFound()
  return <HistoryConfirm />
}
