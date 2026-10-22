import { VaultProvider } from '@/lib/aqua-local-client/VaultProvider'
import { assertHarnessAllowed } from './harness'

// Dev harness layout: one vault session across harness pages (mirrors the
// (app) layout's shared VaultProvider). 404 in production.
export default function JourneyHarnessLayout({ children }: { children: React.ReactNode }) {
  assertHarnessAllowed()
  return <VaultProvider>{children}</VaultProvider>
}
