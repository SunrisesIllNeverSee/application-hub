import { DEV_JOURNEY_CATALOG } from '@/lib/journey/dev-fixture'
import { HarnessInstance } from '../HarnessClient'
import { assertHarnessAllowed } from '../harness'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Journey harness (dev)', robots: { index: false } }

export default async function JourneyHarnessInstancePage({ params }: { params: Promise<{ instanceId: string }> }) {
  assertHarnessAllowed()
  const { instanceId } = await params
  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <p className="rounded border border-dashed border-warning-500 px-2 py-1 text-[11px] text-warning-700 dark:text-warning-300">Dev harness · synthetic catalog · not available in production</p>
        <HarnessInstance catalog={DEV_JOURNEY_CATALOG} instanceId={decodeURIComponent(instanceId)} />
      </div>
    </>
  )
}
