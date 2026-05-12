import { createClient } from '@/lib/supabase/server'
import { IntegrationsForm } from '@/components/IntegrationsForm'

export const metadata = { title: 'Integrations — Profile' }

export default async function ProfileIntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('id, provider, label, status, key_fingerprint, base_url, model_preference, is_default, last_verified_at')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })

  return (
    <div className="max-w-2xl">
      <IntegrationsForm integrations={integrations ?? []} />
    </div>
  )
}
