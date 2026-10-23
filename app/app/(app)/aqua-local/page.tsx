import { notFound } from 'next/navigation'
import { LOCAL_FIRST } from '@/lib/aqua-local-client/flag'
import AquaLocal from './client'

// Local-first surface (LF-10/11/12/15, flag: NEXT_PUBLIC_AQUA_LOCAL_FIRST=1).
// Mirrors the (app)/aqua flag pattern: the whole surface 404s when the flag
// is unset. The (app) layout above still enforces authentication. All private
// answer data lives in the browser IndexedDB vault — this page ships no data.
export const metadata = { title: 'AQUA local vault' }

export default function AquaLocalPage() {
  // Same effective flag as every client gate (NEXT_PUBLIC_AQUA_LOCAL_FIRST,
  // fail-closed in production builds — lib/aqua-local-client/flag.ts).
  if (!LOCAL_FIRST) notFound()
  return <AquaLocal />
}
