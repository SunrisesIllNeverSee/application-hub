import { MARKDOWN_PAGES, NOT_FOUND_MARKDOWN } from '@/lib/agent-content.mjs'

const VARY_VALUE = 'Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch'

interface RouteContext { params: Promise<{ slug?: string[] }> }
function pathnameFromSlug(slug: string[] | undefined) { return slug?.length ? `/${slug.join('/')}` : '/' }
function markdownResponse(body: string, status = 200, includeBody = true) {
  return new Response(includeBody ? body : null, { status, headers: {
    'Content-Type': 'text/markdown; charset=utf-8', 'Vary': VARY_VALUE,
    'Cache-Control': status === 200 ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'no-store',
  }})
}
async function resolveMarkdown(context: RouteContext, includeBody: boolean) {
  const { slug } = await context.params
  const pathname = pathnameFromSlug(slug)
  const body = MARKDOWN_PAGES[pathname]
  if (!body) return markdownResponse(NOT_FOUND_MARKDOWN, 404, includeBody)
  return markdownResponse(body, 200, includeBody)
}
export async function GET(_request: Request, context: RouteContext) { return resolveMarkdown(context, true) }
export async function HEAD(_request: Request, context: RouteContext) { return resolveMarkdown(context, false) }
