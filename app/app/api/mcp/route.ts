// Hosted MCP endpoint. Public URL: https://aquaidp.xyz/mcp
// (middleware rewrites MCP transport requests on /mcp here; browser GETs of
// /mcp still get the docs page).
// Two surfaces share this route: a POST without credentials keeps the public
// read-only catalog behavior (./_lib/hosted.ts); a POST carrying
// `Authorization: Bearer <Supabase access token>` is served by the personal
// workspace surface (./_lib/workspace.ts), which keeps the catalog tools and
// adds the workspace tools resolved against the caller's hosted store.
import { handleMcpDelete, handleMcpGet, handleMcpOptions, handleMcpPost } from './_lib/hosted.ts'
import { bearerToken, handleWorkspaceMcpPost } from './_lib/workspace.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  return bearerToken(req) ? handleWorkspaceMcpPost(req) : handleMcpPost(req)
}

export async function GET(): Promise<Response> {
  return handleMcpGet()
}

export async function DELETE(): Promise<Response> {
  return handleMcpDelete()
}

export async function OPTIONS(): Promise<Response> {
  return handleMcpOptions()
}
