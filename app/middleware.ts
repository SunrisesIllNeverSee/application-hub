import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { appendVaryAccept, preferredType } from '@/lib/accept.mjs'

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
]

const AUTH_ONLY_ROUTES = ['/login']
const NON_NEGOTIATED_PREFIXES = ['/api/', '/auth/', '/_next/', '/_vercel/']

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

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
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

      if (!onboarded && !pathname.startsWith('/onboarding')) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      if (onboarded && (isAuthOnlyRoute || pathname.startsWith('/onboarding'))) {
        const url = request.nextUrl.clone()
        url.pathname = '/dash'
        return NextResponse.redirect(url)
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
