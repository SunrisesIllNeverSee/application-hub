// Canonical public origin for server-built links (emails etc.).
// Never falls back to VERCEL_URL, which is a per-deployment host.

export const DEFAULT_SITE_URL = 'https://aquaidp.xyz'

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL
  try {
    return new URL(raw).origin
  } catch {
    return DEFAULT_SITE_URL
  }
}
