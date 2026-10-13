import { redirect } from 'next/navigation'

export const metadata = {
  title: 'MCP server',
  alternates: { canonical: '/mcp' },
}

export default function McpPage() {
  redirect('/developers#mcp')
}
