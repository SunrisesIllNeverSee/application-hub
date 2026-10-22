import { notFound } from 'next/navigation'
import { ReviewHarness } from './ReviewHarness'

// M09 W5 — DEV-ONLY browser-test harness for the review UI. Seeds a fresh
// IN-MEMORY vault with SYNTHETIC data (lib/review-ui/synthetic-seed.ts) so
// the board, card controls, HTML export and decision import can be driven
// without a login. 404s in production builds.

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Review harness (dev)', robots: { index: false, follow: false } }

export default function ReviewHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ReviewHarness />
}
