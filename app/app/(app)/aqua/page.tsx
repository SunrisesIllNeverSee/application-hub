import { notFound } from 'next/navigation'
import AquaStaging from './client'

// AP-M04-SITE / C1: the entire staging surface — page AND API — lives behind
// one flag. AQUA_STAGING !== '1' → /aqua returns 404 exactly like the API
// proxy; rollback is unsetting a single env var. The (app) layout above this
// still enforces authentication + onboarding.
export const metadata = { title: 'AQUA staging' }

export default function AquaPage() {
  if (process.env.AQUA_STAGING !== '1') notFound()
  return <AquaStaging />
}
