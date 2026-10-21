// AUTH-04: user-facing text for ?error / ?error_description on /login.
// The callback sets error=auth_callback_failed on any failed exchange and
// forwards provider errors (e.g. access_denied) with a short description.

const KNOWN: Record<string, string> = {
  auth_callback_failed:
    'We could not complete your sign-in. The link may have expired or been opened in a different browser than the one you started in. Please try again.',
  access_denied:
    'Sign-in was cancelled or not allowed by the provider. Please try again.',
  otp_expired:
    'That sign-in link has expired or was already used. Please request a new one.',
  server_error:
    'The sign-in provider reported a problem. Please try again in a moment.',
  temporarily_unavailable:
    'The sign-in provider is temporarily unavailable. Please try again in a moment.',
}

// Supabase reports an expired or reused email link as error=access_denied with
// error_code=otp_expired; prefer the more specific code when we have text for it.
export function pickAuthErrorCode(
  error: string | null | undefined,
  errorCode: string | null | undefined
): string | null {
  if (errorCode && Object.hasOwn(KNOWN, errorCode)) return errorCode
  return error || null
}

export function describeAuthError(
  code: string | null | undefined,
  description?: string | null
): string | null {
  if (!code) return null
  // Only fixed text is shown: ?error_description is attacker-controllable, so
  // echoing it would let a crafted link put arbitrary text on the sign-in page.
  void description
  return KNOWN[code] ?? 'Sign-in failed. Please try again.'
}
