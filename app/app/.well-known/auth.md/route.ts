/**
 * app/.well-known/auth.md/route.ts
 *
 * Plain-language authentication guide for agents, referenced by the
 * oauth-* and api-catalog discovery documents.
 */

export const revalidate = 3600

const AUTH_MD = `# AQUA authentication

AQUA (https://aquaidp.xyz) uses Supabase Auth. People sign in at https://aquaidp.xyz/login with an email magic link, email + password, or GitHub.

## What needs no sign-in
- Public pages, the public application catalog, \`/llms.txt\`, \`/openapi.json\`, and the discovery documents under \`/.well-known/\`.
- \`GET /api/health\`.

## What needs a signed-in person
- Signed-in app pages and the authenticated API routes listed in \`/.well-known/oauth-protected-resource\`.
- Requests use the browser session cookie. A route may also accept \`Authorization: Bearer <Supabase access token>\` from the same person's own client.

## Private answers never use these endpoints
AQUA is local-first. Answers, drafts, evidence, approvals and application packets live in an encrypted vault in the user's own browser. They are not stored on or sent to AQUA's servers, so no API exposes them.

## Agents
- Do not ask a person to paste a session token or JWT into a chat.
- To work with a person's applications, use the local AQUA companion (a command-line tool and stdio MCP server that the user runs on their own machine). It holds no account token and no server keys.
- Approving answers, signing packets and submitting applications are human-only actions inside the AQUA app.
`

export async function GET() {
  return new Response(AUTH_MD, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
