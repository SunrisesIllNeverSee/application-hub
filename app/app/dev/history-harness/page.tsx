import { notFound } from 'next/navigation'
import { HistoryHarness } from './HistoryHarness'

// M09b — DEV-ONLY browser-test harness for the "Confirm submitted history"
// screen. Seeds a fresh IN-MEMORY vault with SYNTHETIC history records
// (lib/history-ui/synthetic-seed.ts), shaped like a Restore of a companion
// import-history export. 404s in production builds.

export const dynamic = 'force-dynamic'
export const metadata = { title: 'History harness (dev)', robots: { index: false, follow: false } }

export default function HistoryHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <HistoryHarness />
}
