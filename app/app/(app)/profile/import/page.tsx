import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportClient } from '@/components/ImportClient'

export const metadata = { title: 'Import — Profile' }

export default async function ProfileImportPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <ImportClient />
    </div>
  )
}
