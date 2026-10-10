import { notFound } from 'next/navigation'
import AquaLocal from './client'

// Local-first surface (LF-10/11/12/15, flag: NEXT_PUBLIC_AQUA_LOCAL_FIRST=1).
// Mirrors the (app)/aqua flag pattern: the whole surface 404s when the flag
// is unset. The (app) layout above still enforces authentication. All private
// answer data lives in the browser IndexedDB vault — this page ships no data.
export const metadata = { title: 'AQUA local vault' }

export default function AquaLocalPage() {
  const flag = process.env.NEXT_PUBLIC_AQUA_LOCAL_FIRST
  if (flag !== '1' && flag !== 'true') notFound()
  return <AquaLocal />
}
