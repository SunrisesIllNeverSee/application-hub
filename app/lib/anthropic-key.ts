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

/** If `e` is a ConnectedKeyError, the 422 response parts a route should return; otherwise null. */
export function connectedKeyFailure(e: unknown): { body: ReturnType<typeof connectedKeyErrorBody>; status: number } | null {
  return e instanceof ConnectedKeyError ? { body: connectedKeyErrorBody(), status: e.status } : null
}

const KNOWN_PROVIDERS = ['openai', 'ollama']

/**
 * Non-Anthropic integrations in the order drafting tries them (OpenAI, then Ollama).
 * Anthropic rows are handled by resolveAnthropicKey; unknown providers sort last.
 */
export function nonAnthropicIntegrations<T extends { provider: string }>(rows: T[]): T[] {
  const rank = (p: string) => { const i = KNOWN_PROVIDERS.indexOf(p); return i === -1 ? KNOWN_PROVIDERS.length : i }
  return rows.filter((r) => r.provider !== 'anthropic').sort((a, b) => rank(a.provider) - rank(b.provider))
}

type SupabaseLike = { from: (t: string) => any }

export type ResolvedKey = { apiKey: string; keySource: 'byok' | 'platform' }

/**
 * Active connected Anthropic key if there is one, else the platform key if configured, else null.
 * @throws {ConnectedKeyError} when an active connected Anthropic integration exists but its key is
 *   missing, empty or can't be decrypted. It never falls back to the platform key in that case.
 */
export async function resolveAnthropicKey(
  supabase: SupabaseLike,
  userId: string,
  deps: { decrypt: (encrypted: string, ref: string) => string; platformKey: string | undefined },
): Promise<ResolvedKey | null> {
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('id, key_encrypted, key_storage_ref')
    .eq('user_id', userId)
    .eq('provider', 'anthropic')
    .eq('status', 'active')
    .limit(1)

  const row = integrations?.[0]
  if (row) {
    let apiKey: string | null = null
    let reason = 'missing_key_fields'
    try {
      if (row.key_encrypted && row.key_storage_ref) {
        reason = 'empty_key'
        apiKey = deps.decrypt(row.key_encrypted, row.key_storage_ref)
      }
    } catch (e) {
      reason = e instanceof Error ? e.name : 'decrypt_error'
      apiKey = null
    }
    if (!apiKey) {
      // Name and integration id only: never key material or the error message.
      console.error('[anthropic-key] connected key unusable:', { integration_id: row.id, reason })
      throw new ConnectedKeyError()
    }
    return { apiKey, keySource: 'byok' }
  }

  return deps.platformKey ? { apiKey: deps.platformKey, keySource: 'platform' } : null
}
