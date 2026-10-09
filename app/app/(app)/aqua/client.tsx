'use client'

import { useEffect, useState } from 'react'

// AQUA staging journey (AP-M04-SITE, flag: AQUA_STAGING=1).
// Exercises the canon dev-mirror through /api/aqua/* — real answer_command
// calls, ownership-proven scope, no fixtures. Everything here is disposable-
// staging evidence, not production data.

type WorkRow = {
  question_occurrence_id: string
  original_text: string
  state: string
}
type Draft = { version_id: string; answer_id: string; version_number: number;
  title: string; answer_sha256: string }
type Packets = { packets: { packet_id: string; application_id: string;
  sha256: string; bank_revision: number; status: string }[] }

async function post(route: string, body: object) {
  const r = await fetch(`/api/aqua/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

export default function AquaStaging() {
  const [scope, setScope] = useState<{ applicant_id: string; funnel_id: string } | null>(null)
  const [bank, setBank] = useState<{ bank_revision: number; versions: { version_id: string; title: string }[] } | null>(null)
  const [apps, setApps] = useState<{ application_id: string; name: string }[]>([])
  const [app, setApp] = useState('')
  const [rows, setRows] = useState<WorkRow[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [packets, setPackets] = useState<Packets['packets']>([])
  const [form, setForm] = useState({ qid: '', title: '', answer_text: '',
    answers_what: '', context_limits: '', facts_as_of: '', change_note: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    post('snapshot', {}).then(d => {
      if (!d.ok) return setErr(d.error)
      setScope(d.result.scope); setBank(d.result.bank)
      setApps(d.result.applications ?? [])
      if (d.result.applications?.length) setApp(d.result.applications[0].application_id)
    })
  }, [])

  useEffect(() => {
    if (!app) return
    post('projection', { application_id: app }).then(d => {
      if (d.ok) setRows(d.result.rows ?? d.result ?? [])
    })
    post('packets', { application_id: app }).then(d => {
      if (d.ok) setPackets(d.result.packets ?? [])
    })
  }, [app])

  const submit = async (action: string) => {
    setErr(''); setMsg('')
    const { qid, ...rest } = form
    const d = await post(action, { application_id: app, question_occurrence_id: qid, ...rest })
    if (!d.ok) return setErr(`${action} refused: ${d.error}`)
    setMsg(`${action}: ${JSON.stringify(d.result).slice(0, 160)}`)
    post('packets', { application_id: app }).then(x => { if (x.ok) setPackets(x.result.packets ?? []) })
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">AQUA staging journey</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Dev-mirror bridge · flag-gated · every call is a real canon function.
      </p>

      {err && <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}

      {scope && (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-medium">Scope (server-resolved)</h2>
          <p className="text-sm text-zinc-600">
            applicant <code>{scope.applicant_id}</code> · funnel <code>{scope.funnel_id}</code>
            {bank && <> · bank revision <code>{bank.bank_revision}</code> · {bank.versions.length} versions</>}
          </p>
        </section>
      )}

      {apps.length > 0 && (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-medium">Application</h2>
          <select className="mt-2 w-full rounded border p-2 text-sm" value={app}
            onChange={e => setApp(e.target.value)}>
            {apps.map(a => <option key={a.application_id} value={a.application_id}>
              {a.name} ({a.application_id.slice(0, 14)}…)</option>)}
          </select>
          <ul className="mt-3 divide-y text-sm">
            {rows.map(r => (
              <li key={r.question_occurrence_id} className="flex items-start gap-3 py-2">
                <code className="w-48 shrink-0 text-xs text-zinc-500">{r.state}</code>
                <span>{r.original_text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="font-medium">Draft (persisted canon version)</h2>
        {(['question_occurrence_id', 'title', 'answer_text', 'answers_what',
           'context_limits', 'facts_as_of', 'change_note'] as const).map(k => (
          <input key={k} placeholder={k}
            className="mt-2 w-full rounded border p-2 text-sm"
            value={k === 'question_occurrence_id' ? form.qid : form[k]}
            onChange={e => setForm({ ...form,
              [k === 'question_occurrence_id' ? 'qid' : k]: e.target.value })} />
        ))}
        <button onClick={() => submit('draft')}
          className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm text-white">
          Save draft version</button>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="font-medium">Packets</h2>
        {packets.length === 0 && <p className="mt-2 text-sm text-zinc-500">None frozen yet.</p>}
        <ul className="mt-2 space-y-2 text-sm">
          {packets.map(p => (
            <li key={p.packet_id} className="rounded border p-2">
              <code>{p.packet_id}</code> · {p.status} · sha256 {p.sha256.slice(0, 12)}… ·
              bank_rev {p.bank_revision}
            </li>
          ))}
        </ul>
        <button onClick={() => post('prepare', { application_id: app, evidence: 'staging ui' })
            .then(d => { if (!d.ok) setErr(`prepare refused: ${d.error}`)
                         else setMsg('packet frozen: ' + JSON.stringify(d.result).slice(0, 120))
                         post('packets', { application_id: app })
                           .then(x => { if (x.ok) setPackets(x.result.packets ?? []) }) })}
          className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm text-white">
          Prepare packet</button>
      </section>
    </div>
  )
}
