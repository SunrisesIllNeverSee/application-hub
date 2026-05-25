import { redirect } from 'next/navigation'

import { IngestionUploader } from '@/components/ingestion/IngestionUploader'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Manual intake — Profile' }

export default async function ProfileImportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
          Manual intake
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Stage application material into AQUA&apos;s 7-layer Supabase intake workflow.
          Nothing moves forward without explicit checkpoint approval, and every
          transition is written to the audit trail.
        </p>
      </div>

      <IngestionUploader />
    </div>
  )
}
