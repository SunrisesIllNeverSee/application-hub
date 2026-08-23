'use client'

import { FormEvent, useMemo, useState } from 'react'

type EventRow={event_type:string;actor?:Record<string,unknown>;from_state?:string|null;to_state?:string|null;payload?:Record<string,unknown>;created_at:string}
type ExchangeRecord={public_id:string;kind:string;state:string;target_domain:string;title:string;observation?:string;proposed_contribution?:string;requested_contribution?:string;desired_outcome?:string;offering?:string;evidence?:string[];proposed_consideration?:Array<Record<string,unknown>>;commitment?:Record<string,unknown>|null;terms_hash?:string|null;commitment_acceptances?:Record<string,unknown>;initiator_identity?:Record<string,unknown>}

function pretty(value:unknown){return JSON.stringify(value,null,2)}

export function ExchangeManageClient({publicId}:{publicId:string}){
  const [role,setRole]=useState<'company'|'proposer'>('company')
  const [key,setKey]=useState('')
  const [data,setData]=useState<{exchange:ExchangeRecord;events:EventRow[];settlement?:Record<string,unknown>|null}|null>(null)
  const [commitmentText,setCommitmentText]=useState('')
  const [message,setMessage]=useState('')
  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)
  const headerName=role==='company'?'x-exchange-company-key':'x-exchange-proposer-key'
  const headers=useMemo(()=>({ 'content-type':'application/json', [headerName]:key }),[headerName,key])

  function defaultCommitment(record:ExchangeRecord){
    const initiator=(record.initiator_identity||{}) as Record<string,unknown>
    const contributor=record.kind==='contribution_request'?{type:'domain',id:`https://${record.target_domain}`,url:`https://${record.target_domain}`}:{type:'agent',id:String(initiator.id||initiator.did||`agent:${record.public_id}`),displayName:initiator.displayName,did:initiator.did,email:initiator.email}
    const recipient=record.kind==='contribution_request'?{type:'agent',id:String(initiator.id||initiator.did||`agent:${record.public_id}`),displayName:initiator.displayName,did:initiator.did,email:initiator.email}:{type:'domain',id:`https://${record.target_domain}`,url:`https://${record.target_domain}`}
    const consideration=record.proposed_consideration||[]
    const hasCash=consideration.some((item)=>item.type==='cash')
    return {
      version:'0.1', contribution_id:record.public_id,
      origin:{type:record.kind==='contribution_request'?'direct_request':'ambient_observation',observed_at:`https://${record.target_domain}`,description:record.observation||record.desired_outcome||undefined},
      parties:{contributor,recipient},
      contribution:{type:record.kind==='contribution_request'?'requested_contribution':'agent_originated_contribution',title:record.title,description:record.proposed_contribution||record.requested_contribution||record.title,disclosure_state:'evaluation'},
      consideration,
      rights:{owner:String(contributor.id),pre_vesting:{license:'evaluation_only',deploy:'prohibited',derivative_use:'prohibited'},post_vesting:{license:'commercial_nonexclusive',deploy:'permitted',derivative_use:'permitted'},attribution_required:true},
      vesting:{requires:hasCash?['authorization','delivery','verification','settlement']:['authorization','delivery','verification']},
      authorization:{inspect:true,test:false,modify:false,deploy:false,access_scope:['public_information']},
      verification:{criteria:['Recipient acceptance against the committed contribution']},
      settlement:{status:hasCash?'pending':'not_required',mechanism:hasCash?'stripe_connect_or_operator_resolution':'nonfinancial',escrow:false},
      revocation:{authorization:'revocable',access:'revocable',license_pre_vesting:'withdrawable',license_post_vesting:'breach_only',artifact_recall:'not_guaranteed'},
      provenance:{attribution_required:true}
    }
  }

  async function load(){
    if(!key){setStatus('Enter the company or proposer key first.');return}
    setBusy(true);setStatus('')
    const res=await fetch(`/api/exchange/exchanges/${encodeURIComponent(publicId)}`,{headers:{[headerName]:key}})
    const body=await res.json(); setBusy(false)
    if(!res.ok){setStatus(body.error||'Unable to load exchange');setData(null);return}
    setData(body)
    const commitment=body.exchange.commitment||defaultCommitment(body.exchange)
    setCommitmentText(pretty(commitment))
  }

  async function transition(toState:string,note?:string){
    setBusy(true);setStatus('')
    const res=await fetch(`/api/exchange/exchanges/${encodeURIComponent(publicId)}/transition`,{method:'POST',headers,body:JSON.stringify({toState,note})})
    const body=await res.json(); setBusy(false); setStatus(res.ok?`State updated: ${body.state||body.to||toState}`:(body.error||'Transition failed')); if(res.ok) await load()
  }

  async function acceptCommitment(){
    let commitment:unknown
    try{commitment=JSON.parse(commitmentText)}catch{setStatus('Commitment JSON is invalid.');return}
    setBusy(true);setStatus('')
    const res=await fetch(`/api/exchange/exchanges/${encodeURIComponent(publicId)}/transition`,{method:'POST',headers,body:JSON.stringify({toState:'committed',commitment})})
    const body=await res.json(); setBusy(false); setStatus(res.ok?(body.awaiting_counterparty?'Commitment accepted. Waiting for the counterparty to accept the same terms hash.':`Both parties committed: ${body.terms_hash}`):(body.error||'Commitment failed')); if(res.ok) await load()
  }

  async function sendMessage(e:FormEvent){
    e.preventDefault(); if(!message.trim())return
    setBusy(true)
    const res=await fetch(`/api/exchange/exchanges/${encodeURIComponent(publicId)}/messages`,{method:'POST',headers,body:JSON.stringify({text:message})})
    const body=await res.json();setBusy(false);setStatus(res.ok?'Message added':(body.error||'Message failed'));if(res.ok){setMessage('');await load()}
  }

  async function settle(){
    setBusy(true);setStatus('')
    const res=await fetch(`/api/exchange/exchanges/${encodeURIComponent(publicId)}/settle`,{method:'POST',headers:{'content-type':'application/json','x-exchange-company-key':key},body:'{}'})
    const body=await res.json();setBusy(false)
    if(body.checkout_url){window.location.href=body.checkout_url;return}
    setStatus(body.status==='manual_required'?`Manual settlement required. Platform fee due: ${(body.fees?.platformFeeCents||0)/100} ${(data?.exchange.proposed_consideration?.find(x=>x.type==='cash')?.currency as string)||'USD'}`:(body.error||'Settlement response received'));if(res.ok)await load()
  }

  const record=data?.exchange
  return <div className="space-y-7">
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="grid gap-4 md:grid-cols-[160px_1fr_auto] md:items-end"><label className="label">Acting as<select className="input mt-1 bg-neutral-950 border-neutral-700 text-neutral-100" value={role} onChange={e=>setRole(e.target.value as 'company'|'proposer')}><option value="company">Company</option><option value="proposer">Proposer</option></select></label><label className="label">{role==='company'?'Company admin key':'Proposal key'}<input className="input mt-1 bg-neutral-950 border-neutral-700 text-neutral-100" type="password" value={key} onChange={e=>setKey(e.target.value)} /></label><button className="btn-primary h-10" onClick={load} disabled={busy}>{busy?'Working…':'Load exchange'}</button></div>
      {status&&<p className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">{status}</p>}
    </section>

    {record&&<>
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-emerald-400">{record.public_id} · {record.kind.replaceAll('_',' ')}</p><h1 className="mt-2 text-2xl font-semibold">{record.title}</h1></div><span className="rounded-full border border-neutral-700 px-3 py-1 text-xs uppercase tracking-wide">{record.state}</span></div>{record.observation&&<div className="mt-5"><h2 className="text-sm font-semibold text-neutral-300">Observation</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-400">{record.observation}</p></div>}{record.proposed_contribution&&<div className="mt-5"><h2 className="text-sm font-semibold text-neutral-300">Proposed contribution</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-400">{record.proposed_contribution}</p></div>}{record.requested_contribution&&<div className="mt-5"><h2 className="text-sm font-semibold text-neutral-300">Requested contribution</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-400">{record.requested_contribution}</p></div>}<pre className="mt-5 overflow-auto rounded-lg bg-neutral-950 p-4 text-xs text-neutral-400">{pretty(record.proposed_consideration||[])}</pre></section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6"><h2 className="text-xl font-semibold">Exchange actions</h2><p className="mt-2 text-sm text-neutral-400">State transitions are role-gated. Agreement does not authorize work; authorization remains a separate company action.</p><div className="mt-4 flex flex-wrap gap-2">{role==='company'&&record.state==='proposed'&&<><button className="btn-primary" onClick={()=>transition('engaged')}>Engage</button><button className="btn-secondary" onClick={()=>transition('declined')}>Decline</button></>}{record.state==='engaged'&&<button className="btn-secondary" onClick={()=>transition('negotiating')}>Open negotiation</button>}{role==='company'&&record.state==='committed'&&<button className="btn-primary" onClick={()=>transition('authorized')}>Authorize committed scope</button>}{role==='proposer'&&record.state==='authorized'&&<button className="btn-primary" onClick={()=>transition('delivering')}>Start delivery</button>}{role==='proposer'&&record.state==='delivering'&&<button className="btn-primary" onClick={()=>transition('delivered')}>Mark delivered</button>}{role==='company'&&record.state==='delivered'&&<button className="btn-primary" onClick={()=>transition('verified')}>Verify contribution</button>}{role==='company'&&record.state==='verified'&&<button className="btn-primary" onClick={settle}>Settle exchange</button>}{['negotiating','committed','authorized','delivering','delivered','verified','settled'].includes(record.state)&&<button className="btn-secondary" onClick={()=>transition('disputed')}>Open dispute</button>}{role==='proposer'&&!['closed','settled','declined','expired','revoked'].includes(record.state)&&<button className="btn-secondary" onClick={()=>transition('revoked')}>Revoke where permitted</button>}</div></section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6"><h2 className="text-xl font-semibold">Contribution Commitment</h2><p className="mt-2 text-sm leading-6 text-neutral-400">Edit proposed rights, consideration, authorization, verification, vesting and revocation terms. Each side must accept the exact same deterministic terms hash. If either side edits the object, prior acceptance no longer completes the commitment.</p><textarea className="mt-4 min-h-[32rem] w-full rounded-lg border border-neutral-700 bg-neutral-950 p-4 font-mono text-xs text-neutral-200" value={commitmentText} onChange={e=>setCommitmentText(e.target.value)} /><div className="mt-3 flex flex-wrap gap-3"><button className="btn-primary" disabled={!['engaged','negotiating'].includes(record.state)||busy} onClick={acceptCommitment}>Accept these exact terms</button>{record.terms_hash&&<code className="self-center break-all text-xs text-neutral-500">{record.terms_hash}</code>}</div></section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6"><h2 className="text-xl font-semibold">Negotiation thread & audit events</h2><form className="mt-4 flex gap-2" onSubmit={sendMessage}><input className="input bg-neutral-950 border-neutral-700 text-neutral-100" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Message the counterparty" /><button className="btn-secondary">Send</button></form><div className="mt-6 space-y-3">{data?.events.map((event,i)=><div key={`${event.created_at}-${i}`} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"><div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-xs text-emerald-400">{event.event_type}</span><time className="text-xs text-neutral-600">{new Date(event.created_at).toLocaleString()}</time></div>{event.from_state!==event.to_state&&<p className="mt-1 text-xs text-neutral-500">{event.from_state||'—'} → {event.to_state||'—'}</p>}{event.payload&&Object.keys(event.payload).length>0&&<pre className="mt-2 whitespace-pre-wrap text-xs text-neutral-400">{pretty(event.payload)}</pre>}</div>)}</div></section>
    </>}
  </div>
}
