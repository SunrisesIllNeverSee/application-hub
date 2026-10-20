// AUTH-02: only offer OAuth providers that Supabase reports as enabled.
// Source of truth is the public GET <supabase>/auth/v1/settings endpoint.

export type OAuthProviderId = 'github' | 'google' | 'linkedin_oidc'
export type EnabledProviders = Record<OAuthProviderId, boolean>

export const NO_PROVIDERS: EnabledProviders = {
  github: false,
  google: false,
  linkedin_oidc: false,
}

/** Fail closed: anything other than an explicit `true` is disabled. */
export function parseEnabledProviders(settings: unknown): EnabledProviders {
  const external =
    settings && typeof settings === 'object'
      ? (settings as { external?: unknown }).external
      : null
  if (!external || typeof external !== 'object') return { ...NO_PROVIDERS }
  const flags = external as Record<string, unknown>
  return {
    github: flags.github === true,
    google: flags.google === true,
    linkedin_oidc: flags.linkedin_oidc === true,
  }
}

export async function fetchEnabledProviders(
  supabaseUrl: string | undefined,
  anonKey: string | undefined,
  signal?: AbortSignal
): Promise<EnabledProviders> {
  if (!supabaseUrl || !anonKey) return { ...NO_PROVIDERS }
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      signal,
    })
    if (!res.ok) return { ...NO_PROVIDERS }
    return parseEnabledProviders(await res.json())
  } catch {
    return { ...NO_PROVIDERS }
  }
}
