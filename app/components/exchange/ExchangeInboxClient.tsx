'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'

type InboxExchange = {
  public_id: string
  kind: string
  state: string
  title: string
  initiator_identity?: { displayName?: string; did?: string; id?: string }
  proposed_consideration?: Array<{ type?: string; amount?: number; currency?: string; rate?: number }>
  created_at: string
}

export function ExchangeInboxClient() {
  const [domain, setDomain] = useState('mos2es.xyz')
  const [companyKey, setCompanyKey] = useState('')
  const [items, setItems] = useState<InboxExchange[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    const res = await fetch(`/api/exchange/exchanges?domain=${encodeURIComponent(domain)}`, { headers: { 'x-exchange-company-key': companyKey } })
    const body = await res.json()
    if (!res.ok) { setError(body.error || 'Inbox unavailable'); setItems([]) }
    else setItems(body.exchanges || [])
    setBusy(false)
  }

  function considerationLabel(value: InboxExchange['proposed_consideration']) {
    if (!value?.length) return 'No financial consideration specified'
    return value.map((item) => item.type === 'cash' ? `${item.currency || 'USD'} ${item.amount}` : item.type === 'royalty' ? `${item.rate}% royalty` : item.type).join(' + ')
  }

  return <div>
    <form onSubmit={load} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="label">Domain<input className="input mt-1 bg-neutral-950 border-neutral-700 text-neutral-100" value={domain} onChange={e=>setDomain(e.target.value)} required /></label>
      <label className="label">Company admin key<input className="input mt-1 bg-neutral-950 border-neutral-700 text-neutral-100" type="password" value={companyKey} onChange={e=>setCompanyKey(e.target.value)} required /></label>
      <button className="btn-primary h-10" disabled={busy}>{busy?'Loading…':'Load inbox'}</button>
    </form>
    {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
    <div className="mt-7 space-y-3">
      {items.map(item => <article key={item.public_id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-emerald-400">{item.public_id} · {item.kind.replaceAll('_',' ')}</p><h2 className="mt-1 text-lg font-semibold">{item.title}</h2></div><span className="rounded-full border border-neutral-700 px-3 py-1 text-xs uppercase tracking-wide text-neutral-300">{item.state}</span></div>
        <p className="mt-3 text-sm text-neutral-400">From {item.initiator_identity?.displayName || item.initiator_identity?.did || item.initiator_identity?.id || 'guest agent'} · {considerationLabel(item.proposed_consideration)}</p>
        <div className="mt-4 flex gap-3"><Link className="btn-secondary" href={`/exchange/manage/${encodeURIComponent(item.public_id)}`}>Open exchange</Link><span className="self-center text-xs text-neutral-600">{new Date(item.created_at).toLocaleString()}</span></div>
      </article>)}
      {!busy && !error && items.length===0 && <p className="text-sm text-neutral-500">Load the inbox to review agent-originated proposals.</p>}
    </div>
  </div>
}
