import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { resolveSafeRedirect, sanitizeNextPath } from '@/lib/safe-redirect'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  // Same-origin relative paths only (AUTH-06 / EI-08); default /applications.
  const nextParam = requestUrl.searchParams.get('next')
  const safeNext = sanitizeNextPath(nextParam)

  if (code || (tokenHash && type)) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: CookieToSet[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component context — safe to ignore
            }
          },
        },
      }
    )

    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: type!,
        })

    if (!error) {
      return NextResponse.redirect(resolveSafeRedirect(safeNext, requestUrl.origin))
    }
  }

  // Something went wrong — send back to login with an error hint. Provider
  // errors (?error=...&error_description=...) are forwarded, truncated, so the
  // login page can show them; the return path is kept so the user can retry.
  const loginUrl = new URL('/login', requestUrl.origin)
  const providerError = requestUrl.searchParams.get('error')
  if (providerError) {
    loginUrl.searchParams.set('error', providerError.slice(0, 64))
    const description = requestUrl.searchParams.get('error_description')
    if (description) loginUrl.searchParams.set('error_description', description.slice(0, 200))
  } else {
    loginUrl.searchParams.set('error', 'auth_callback_failed')
  }
  if (safeNext) loginUrl.searchParams.set('next', safeNext)
  return NextResponse.redirect(loginUrl)
}
