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

export function describeAuthError(
  code: string | null | undefined,
  description?: string | null
): string | null {
  if (!code) return null
  if (KNOWN[code]) return KNOWN[code]
  const detail = description ? description.replace(/\+/g, ' ').trim().slice(0, 200) : ''
  return detail
    ? `Sign-in failed: ${detail}`
    : 'Sign-in failed. Please try again.'
}
