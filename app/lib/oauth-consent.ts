import type { SupabaseClient } from '@supabase/supabase-js'

type ConsentApi = Pick<SupabaseClient['auth']['oauth'],
  'getAuthorizationDetails' | 'approveAuthorization' | 'denyAuthorization'>

export async function loadConsentRequest(oauth: ConsentApi, authorizationId: string) {
  const { data, error } = await oauth.getAuthorizationDetails(authorizationId)
  if (error) throw new Error(`Could not load the authorization request: ${error.message}`)
  if (!data || (!('authorization_id' in data) && !('redirect_url' in data))) {
    throw new Error('The authorization server returned no request details. Return to OpenAI and reconnect.')
  }
  if ('authorization_id' in data) {
    const flatName = 'client_name' in data && typeof data.client_name === 'string' ? data.client_name : ''
    if (!data.client?.id?.trim() && !data.client?.name?.trim() && !flatName.trim()) {
      throw new Error('The requesting application could not be identified. Return to OpenAI and reconnect.')
    }
  }
  return data
}

export async function decideConsentRequest(
  oauth: ConsentApi,
  authorizationId: string,
  action: 'approve' | 'deny',
) {
  if (action !== 'approve' && action !== 'deny') throw new Error('Unsupported consent decision.')
  const { data, error } = action === 'approve'
    ? await oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
  if (error) throw new Error(`The ${action} could not be completed: ${error.message}`)
  if (!data?.redirect_url) throw new Error('The authorization server returned no redirect. Return to OpenAI and reconnect.')
  return data.redirect_url
}
