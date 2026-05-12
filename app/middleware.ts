import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// All routes that require authentication
const PROTECTED_ROUTES = [
  '/dash',
  '/applications',
  '/questions',
  '/answers',
  '/workspace',
  '/profile',
  '/bank',
  '/hub',
  '/funders',
  '/archive',
  '/today',
  '/onboarding',
]

// Routes that authenticated + onboarded users should be redirected away from
const AUTH_ONLY_ROUTES = ['/login']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must call getUser() to keep session alive
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  )

  // Unauthenticated user hitting a protected route → login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    // Authenticated user hitting login or root → check onboarding state first
    const isAuthOnlyRoute = AUTH_ONLY_ROUTES.includes(pathname) || pathname === '/'

    // For authenticated users on any route, check onboarding completion
    // Only query DB when needed: protected routes + auth-only routes
    if (isProtected || isAuthOnlyRoute) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed_at')
        .eq('user_id', user.id)
        .maybeSingle<{ onboarding_completed_at: string | null }>()

      const onboarded = !!profile?.onboarding_completed_at

      // Not yet onboarded — send to onboarding (but don't loop)
      if (!onboarded && !pathname.startsWith('/onboarding')) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      // Already onboarded — redirect away from login/root/onboarding to dash
      if (onboarded && (isAuthOnlyRoute || pathname.startsWith('/onboarding'))) {
        const url = request.nextUrl.clone()
        url.pathname = '/dash'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
