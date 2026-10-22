import { createClient } from '@/lib/supabase/server'
import { loadJourneyCatalog } from '@/lib/journey-catalog'
import { InstanceJourney } from '@/components/journey/InstanceJourney'
import { PROD_ENV } from '@/components/journey/ui'

// M09 W6 — Steps D–H for one private application instance. The instance
// itself lives only in the browser vault; the server provides the public
// catalog so catalog-backed instances can show the template wording.
export const metadata = { title: 'Application' }
export const dynamic = 'force-dynamic'

export default async function ApplyInstancePage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params
  const supabase = await createClient()
  const catalog = await loadJourneyCatalog(supabase)
  return (
    <div className="max-w-4xl">
      <InstanceJourney instanceId={decodeURIComponent(instanceId)} catalog={catalog} env={PROD_ENV} />
    </div>
  )
}
