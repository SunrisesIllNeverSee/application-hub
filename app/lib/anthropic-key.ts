// Pure key resolution for Anthropic calls. Relative imports only, so plain-node tests can load it.
// A connected key that cannot be used is an error; it never falls through to AQUA's platform key.

export const CONNECTED_KEY_ERROR_MESSAGE =
  "Your connected Anthropic key couldn't be used. Reconnect it in Profile → Integrations."
export const CONNECTED_KEY_ERROR_CODE = 'connected_key_unusable'
export const CONNECTED_KEY_ERROR_STATUS = 422

export class ConnectedKeyError extends Error {
  readonly code = CONNECTED_KEY_ERROR_CODE
  readonly status = CONNECTED_KEY_ERROR_STATUS
  constructor() {
    super(CONNECTED_KEY_ERROR_MESSAGE)
    this.name = 'ConnectedKeyError'
  }
}

/** JSON body for a route to return when a connected key is unusable. */
export function connectedKeyErrorBody() {
  return { error: CONNECTED_KEY_ERROR_MESSAGE, code: CONNECTED_KEY_ERROR_CODE }
}

type SupabaseLike = { from: (t: string) => any }

export type ResolvedKey = { apiKey: string; keySource: 'byok' | 'platform' }

/**
 * Active connected Anthropic key if there is one (error if it cannot be decrypted),
 * else the platform key if configured, else null.
 */
export async function resolveAnthropicKey(
  supabase: SupabaseLike,
  userId: string,
  deps: { decrypt: (encrypted: string, ref: string) => string; platformKey: string | undefined },
): Promise<ResolvedKey | null> {
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('key_encrypted, key_storage_ref')
    .eq('user_id', userId)
    .eq('provider', 'anthropic')
    .eq('status', 'active')
    .limit(1)

  const row = integrations?.[0]
  if (row) {
    let apiKey: string | null = null
    try {
      if (row.key_encrypted && row.key_storage_ref) apiKey = deps.decrypt(row.key_encrypted, row.key_storage_ref)
    } catch {
      apiKey = null
    }
    if (!apiKey) throw new ConnectedKeyError()
    return { apiKey, keySource: 'byok' }
  }

  return deps.platformKey ? { apiKey: deps.platformKey, keySource: 'platform' } : null
}
