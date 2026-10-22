import { notFound } from 'next/navigation'
import { HistoryConfirm } from '@/components/history/HistoryConfirm'

// M09b — "Confirm submitted history" (protected: middleware PROTECTED_ROUTES
// + the (app) layout's auth gate). The records live only in the browser
// vault; this page ships no data. 404s unless local-first is enabled.
export const metadata = { title: 'Confirm submitted history', robots: { index: false, follow: false } }

export default function HistoryPage() {
  const flag = process.env.NEXT_PUBLIC_AQUA_LOCAL_FIRST
  if (flag !== '1' && flag !== 'true') notFound()
  return <HistoryConfirm />
}
