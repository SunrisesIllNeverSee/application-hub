import { DEV_JOURNEY_CATALOG } from '@/lib/journey/dev-fixture'
import { HarnessStart } from './HarnessClient'
import { assertHarnessAllowed } from './harness'

// M09 W6 — DEV HARNESS (404 in production). Renders the real journey
// screens with a SYNTHETIC catalog fixture and no auth, so the browser walk
// can exercise Steps A–H. The extract-url / candidates routes are stubbed by
// the browser test (network interception), never by this page.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Journey harness (dev)', robots: { index: false } }

export default async function JourneyHarnessPage({ searchParams }: { searchParams: Promise<{ program?: string; path?: string; url?: string }> }) {
  assertHarnessAllowed()
  const { program, path, url } = await searchParams
  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <p className="rounded border border-dashed border-warning-500 px-2 py-1 text-[11px] text-warning-700 dark:text-warning-300">Dev harness · synthetic catalog · not available in production</p>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Start an application</h1>
        <HarnessStart catalog={DEV_JOURNEY_CATALOG} program={program ?? null} path={path ?? null} url={url ?? null} />
      </div>
    </>
  )
}
