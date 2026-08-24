import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import type { ExchangeState } from '@/exchange-gateway/src/types'

export function getExchangeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Exchange gateway requires server-side Supabase credentials')
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function normalizeDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase()
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export function newSecret(prefix = 'cx'): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`
}

export function newPublicId(): string {
  return `CX-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`
}

export function newReferralCode(): string {
  return `AG-${randomBytes(4).toString('hex').toUpperCase()}`
}

export function requestIdentity(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || 'unknown'
}

export async function findCompany(domain: string) {
  const admin = getExchangeAdmin()
  const { data, error } = await admin.from('exchange_companies').select('*').eq('domain', normalizeDomain(domain)).maybeSingle()
  if (error) throw error
  return data
}

export async function authenticateCompany(domain: string, key: string | null): Promise<boolean> {
  if (!key) return false
  const normalized = normalizeDomain(domain)
  const referenceKey = process.env.EXCHANGE_REFERENCE_ADMIN_KEY
  if (normalized === normalizeDomain(process.env.EXCHANGE_REFERENCE_DOMAIN ?? 'mos2es.xyz') && referenceKey && key === referenceKey) return true
  const company = await findCompany(normalized)
  return !!company?.admin_key_hash && hashSecret(key) === company.admin_key_hash
}

export async function authenticateDomainAgent(domain: string, key: string | null): Promise<boolean> {
  if (!key) return false
  const company = await findCompany(domain)
  return !!company?.domain_agent_key_hash && hashSecret(key) === company.domain_agent_key_hash
}

export function authenticateProposer(record: { proposer_key_hash?: string | null }, key: string | null): boolean {
  return !!key && !!record.proposer_key_hash && hashSecret(key) === record.proposer_key_hash
}

export async function appendExchangeEvent(input: {
  exchangeId: string
  eventType: string
  actor: Record<string, unknown>
  fromState?: ExchangeState | null
  toState?: ExchangeState | null
  payload?: Record<string, unknown>
}) {
  const admin = getExchangeAdmin()
  const { error } = await admin.from('exchange_events').insert({
    exchange_id: input.exchangeId,
    event_type: input.eventType,
    actor: input.actor,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    payload: input.payload ?? {},
  })
  if (error) throw error
}
