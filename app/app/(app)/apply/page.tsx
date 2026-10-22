import { createClient } from '@/lib/supabase/server'
import { loadJourneyCatalog } from '@/lib/journey-catalog'
import { ApplyStart } from '@/components/journey/ApplyStart'
import { PROD_ENV } from '@/components/journey/ui'

// M09 W6 — "Start an application": the single entry for every path
// (catalog · URL · paste · file · my applications). The server ships only
// the public, approved catalog; everything private stays in the browser
// vault (local-first).
export const metadata = { title: 'Start an application' }
export const dynamic = 'force-dynamic'

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ program?: string; path?: string; url?: string }> }) {
  const { program, path, url } = await searchParams
  const supabase = await createClient()
  const catalog = await loadJourneyCatalog(supabase)
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Start an application</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Choose a program from the catalog or bring your own application. Your answers stay encrypted on this device.
        </p>
      </div>
      <ApplyStart catalog={catalog} env={PROD_ENV} initialProgramSlug={program ?? null} initialPath={path ?? null} initialUrl={url ?? null} />
    </div>
  )
}
