import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { appendVaryAccept, preferredType } from '@/lib/accept.mjs'
import { isBrowseOnlyPath } from '@/lib/browse-gate'
import { sanitizeNextPath } from '@/lib/safe-redirect'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const PROTECTED_ROUTES = [
  '/dash',
  '/applications',
  '/questions',
  '/answers',
  '/workspace',
  '/workstation',
  '/community',
  '/profile',
  '/bank',
  '/hub',
  '/funders',
  '/archive',
  '/today',
  '/onboarding',
  '/aqua-local',
]

const AUTH_ONLY_ROUTES = ['/login']
const NON_NEGOTIATED_PREFIXES = ['/api/', '/auth/', '/_next/', '/_vercel/', '/.well-known/']

function isProtectedPath(pathname: string) {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

function isNegotiablePath(pathname: string, isProtected: boolean) {
  if (isProtected || AUTH_ONLY_ROUTES.includes(pathname)) return false
  if (NON_NEGOTIATED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false
  if (pathname.includes('.') && !pathname.endsWith('.md')) return false
  return true
}

function markdownRewrite(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  const canonicalPath = pathname.endsWith('.md') ? pathname.slice(0, -3) || '/' : pathname
  url.pathname = canonicalPath === '/' ? '/api/markdown' : `/api/markdown${canonicalPath}`
  const response = NextResponse.rewrite(url)
  response.headers.set('Vary', 'Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = isProtectedPath(pathname)
  const isNegotiable = isNegotiablePath(pathname, isProtected)

  if (pathname.endsWith('.md') && isNegotiable) {
    return markdownRewrite(request, pathname)
  }

  if (isNegotiable) {
    const acceptHeader = request.headers.get('accept')
    const chosen = preferredType(acceptHeader)

    if (chosen === 'text/markdown') return markdownRewrite(request, pathname)

    if (chosen === null && acceptHeader) {
      return new Response('Not Acceptable\n\nAvailable: text/html, text/markdown\n', {
        status: 406,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Vary': 'Accept',
        },
      })
    }
  }

  // M08-PRD-004 (owner d5): stamp the path so the (app) layout's onboarding
  // gate can apply the same browse-only exception as this middleware.
  // Stamped directly on request.headers (not a copy) — the Supabase setAll
  // cookie handler rebuilds NextResponse.next({ request }) on every session
  // refresh, and a header on a detached copy would be silently dropped.
  // INVARIANT: this stamp must stay unconditional for every matcher-covered
  // route — it overwrites any client-supplied x-aqua-path, which is what makes
  // trusting it in (app)/layout safe. Do not gate it behind conditions.
  const browseOnly = isBrowseOnlyPath(pathname)
  request.headers.set('x-aqua-path', pathname)

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtected && !browseOnly) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Keep the query string so deep links survive login; the login page
    // validates `next` with the shared safe-redirect helper.
    url.search = ''
    url.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  if (user) {
    const isAuthOnlyRoute = AUTH_ONLY_ROUTES.includes(pathname) || pathname === '/'

    if (isProtected || isAuthOnlyRoute) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_completed_at')
        .eq('user_id', user.id)
        .maybeSingle<{ onboarding_completed_at: string | null }>()

      const onboarded = !!profile?.onboarding_completed_at

      // M08-PRD-004 (owner d5 "explore first"): un-onboarded signed-in users
      // may browse the program catalog read-only. Everything that writes —
      // workspaces, vault, bank, submissions — still gates to /onboarding.
      if (!onboarded && !pathname.startsWith('/onboarding') && !browseOnly) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      if (onboarded && (isAuthOnlyRoute || pathname.startsWith('/onboarding'))) {
        // A signed-in user sent to /login?next=... goes straight to next.
        const next = pathname === '/login' ? sanitizeNextPath(request.nextUrl.searchParams.get('next')) : null
        return NextResponse.redirect(new URL(next ?? '/dash', request.nextUrl.origin))
      }
    }
  }

  if (isNegotiable) {
    const existingVary = supabaseResponse.headers.get('Vary') ?? ''
    const fullVary = 'Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch'
    if (!existingVary.toLowerCase().includes('accept')) {
      supabaseResponse.headers.set('Vary', fullVary)
    }
  }
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
