// Hosted read-only MCP endpoint. Public URL: https://aquaidp.xyz/mcp
// (middleware rewrites MCP transport requests on /mcp here; browser GETs of
// /mcp still get the docs page). Logic and rules: ./_lib/hosted.ts.
import { handleMcpDelete, handleMcpGet, handleMcpOptions, handleMcpPost } from './_lib/hosted.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  return handleMcpPost(req)
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
