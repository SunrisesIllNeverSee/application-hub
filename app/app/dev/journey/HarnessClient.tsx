'use client'

// Dev harness wiring: same screens, harness env (review stand-in shown,
// links stay under /dev/journey). Never reachable in production.
import { ApplyStart } from '@/components/journey/ApplyStart'
import { InstanceJourney } from '@/components/journey/InstanceJourney'
import { reviewHrefFor, type JourneyEnv } from '@/components/journey/ui'
import type { JourneyCatalog } from '@/lib/journey/review-model'

const ENV: JourneyEnv = {
  basePath: '/dev/journey',
  reviewHref: reviewHrefFor,
  harness: true,
}

export function HarnessStart({ catalog, program, path, url }: { catalog: JourneyCatalog; program: string | null; path: string | null; url?: string | null }) {
  return <ApplyStart catalog={catalog} env={ENV} initialProgramSlug={program} initialPath={path} initialUrl={url ?? null} />
}

export function HarnessInstance({ catalog, instanceId }: { catalog: JourneyCatalog; instanceId: string }) {
  return <InstanceJourney catalog={catalog} instanceId={instanceId} env={ENV} />
}
