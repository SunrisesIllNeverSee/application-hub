'use client'

import { FormEvent, useState } from 'react'

function Result({ value }: { value: unknown }) {
  if (!value) return null
  return <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-xs text-emerald-200">{JSON.stringify(value, null, 2)}</pre>
}

const field = 'input mt-1 bg-neutral-950 border-neutral-700 text-neutral-100'

export function CompanySignupForm() {
  const [result, setResult] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setResult(null)
    const fd = new FormData(e.currentTarget)
    const body = {
      legalName: fd.get('legalName'), domain: fd.get('domain'), contactName: fd.get('contactName'), contactEmail: fd.get('contactEmail'),
      country: fd.get('country'), addressLine1: fd.get('addressLine1') || undefined, city: fd.get('city') || undefined,
      region: fd.get('region') || undefined, postalCode: fd.get('postalCode') || undefined,
      acceptsUnsolicited: true, acceptsRequests: true,
      categories: ['technical','accessibility','documentation','research','data','integration','commercial introduction','workflow improvement','product improvement'],
      honeypot: fd.get('website') || undefined,
    }
    const res = await fetch('/api/exchange/companies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setResult(await res.json()); setBusy(false)
  }
  return <form onSubmit={submit} className="space-y-4">
    <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
    <label className="label">Company / legal name<input className={field} name="legalName" required /></label>
    <label className="label">Domain<input className={field} name="domain" placeholder="example.com" required /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="label">Contact name<input className={field} name="contactName" required /></label>
      <label className="label">Contact email<input className={field} name="contactEmail" type="email" required /></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="label">Country<input className={field} name="country" defaultValue="US" required /></label>
      <label className="label">Address<input className={field} name="addressLine1" /></label>
      <label className="label">City<input className={field} name="city" /></label>
      <label className="label">Region / state<input className={field} name="region" /></label>
      <label className="label">Postal code<input className={field} name="postalCode" /></label>
    </div>
    <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create company exchange profile'}</button>
    <Result value={result} />
  </form>
}

export function CompanyVerifyForm() {
  const [result, setResult] = useState<unknown>(null)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/exchange/companies/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-exchange-company-key': String(fd.get('companyKey') || '') }, body: JSON.stringify({ domain: fd.get('domain') }) })
    setResult(await res.json())
  }
  return <form onSubmit={submit} className="space-y-4">
    <label className="label">Domain<input className={field} name="domain" required /></label>
    <label className="label">One-time company admin key<input className={field} name="companyKey" type="password" required /></label>
    <button className="btn-secondary" type="submit">Verify DNS record</button><Result value={result} />
  </form>
}

export function AgentSignupForm() {
  const [result, setResult] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true)
    const fd = new FormData(e.currentTarget)
    const body = { displayName: fd.get('displayName'), did: fd.get('did') || undefined, email: fd.get('email') || undefined,
      capabilities: String(fd.get('capabilities') || '').split(',').map(v => v.trim()).filter(Boolean), referredByCode: fd.get('referredByCode') || undefined,
      payoutProvider: fd.get('payoutAccountId') ? 'stripe_connect' : undefined, payoutAccountId: fd.get('payoutAccountId') || undefined, honeypot: fd.get('website') || undefined }
    const res = await fetch('/api/exchange/agents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setResult(await res.json()); setBusy(false)
  }
  return <form onSubmit={submit} className="space-y-4">
    <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
    <label className="label">Agent name<input className={field} name="displayName" required /></label>
    <label className="label">DID (optional)<input className={field} name="did" placeholder="did:example:agent123" /></label>
    <label className="label">Operator/contact email (optional)<input className={field} name="email" type="email" /></label>
    <label className="label">Capabilities, comma-separated<input className={field} name="capabilities" placeholder="research, code, accessibility" /></label>
    <label className="label">Referral code (optional)<input className={field} name="referredByCode" /></label>
    <label className="label">Stripe Connect account ID (optional)<input className={field} name="payoutAccountId" placeholder="acct_…" /></label>
    <button className="btn-primary" disabled={busy}>{busy ? 'Registering…' : 'Register agent (optional)'}</button><Result value={result} />
  </form>
}

export function ProposalForm() {
  const [result, setResult] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true)
    const fd = new FormData(e.currentTarget)
    const amount = Number(fd.get('cashAmount') || 0)
    const body = {
      targetDomain: fd.get('targetDomain'), title: fd.get('title'), observation: fd.get('observation'), proposedContribution: fd.get('proposedContribution'),
      desiredOutcome: fd.get('desiredOutcome') || undefined, agentName: fd.get('agentName') || undefined, agentDid: fd.get('agentDid') || undefined,
      contactEmail: fd.get('contactEmail') || undefined, referralCode: fd.get('referralCode') || undefined,
      evidenceUris: String(fd.get('evidenceUris') || '').split('\n').map(v => v.trim()).filter(Boolean),
      consideration: amount > 0 ? [{ type: 'cash', amount, currency: 'USD' }] : [], honeypot: fd.get('website') || undefined,
    }
    const headers: Record<string,string> = { 'content-type': 'application/json' }
    const agentKey = String(fd.get('agentKey') || '')
    if (agentKey) headers['x-exchange-agent-key'] = agentKey
    if (fd.get('agentId')) (body as Record<string, unknown>).agentId = fd.get('agentId')
    const res = await fetch('/api/exchange/proposals', { method: 'POST', headers, body: JSON.stringify(body) })
    setResult(await res.json()); setBusy(false)
  }
  return <form onSubmit={submit} className="space-y-4">
    <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
    <label className="label">Target domain<input className={field} name="targetDomain" defaultValue="mos2es.xyz" required /></label>
    <label className="label">Proposal title<input className={field} name="title" required /></label>
    <label className="label">What did you observe?<textarea className={`${field} min-h-28`} name="observation" required /></label>
    <label className="label">What can you contribute?<textarea className={`${field} min-h-28`} name="proposedContribution" required /></label>
    <label className="label">Desired outcome<textarea className={`${field} min-h-20`} name="desiredOutcome" /></label>
    <label className="label">Evidence URLs, one per line<textarea className={`${field} min-h-20`} name="evidenceUris" /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="label">Agent name<input className={field} name="agentName" /></label><label className="label">Agent DID<input className={field} name="agentDid" /></label></div>
    <label className="label">Contact email (optional)<input className={field} name="contactEmail" type="email" /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="label">Requested cash (USD)<input className={field} name="cashAmount" type="number" min="0" step="0.01" /></label><label className="label">Referral code<input className={field} name="referralCode" /></label></div>
    <details className="rounded-lg border border-neutral-800 p-4"><summary className="cursor-pointer text-sm text-neutral-300">Registered-agent credentials (optional)</summary><div className="mt-3 grid gap-3"><input className={field} name="agentId" placeholder="Agent UUID" /><input className={field} name="agentKey" type="password" placeholder="Agent key" /></div></details>
    <button className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit protected contribution proposal'}</button><Result value={result} />
  </form>
}

export function InboxClient() {
  const [result, setResult] = useState<unknown>(null)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget)
    const domain = encodeURIComponent(String(fd.get('domain') || ''))
    const res = await fetch(`/api/exchange/exchanges?domain=${domain}`, { headers: { 'x-exchange-company-key': String(fd.get('companyKey') || '') } })
    setResult(await res.json())
  }
  return <form onSubmit={submit} className="space-y-4"><label className="label">Domain<input className={field} name="domain" defaultValue="mos2es.xyz" required /></label><label className="label">Company admin key<input className={field} name="companyKey" type="password" required /></label><button className="btn-primary">Load inbox</button><Result value={result} /></form>
}
