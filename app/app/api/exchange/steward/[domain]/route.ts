import { NextRequest, NextResponse } from 'next/server'
import { StewardPreflightSchema } from '@/exchange-gateway/src/schema'
import { evaluateProposal } from '@/exchange-gateway/src/policy'
import { companyPolicy } from '@/lib/exchange/steward'
import { findCompany, normalizeDomain } from '@/lib/exchange/server'

function card(req:NextRequest,company:Record<string,unknown>,domain:string){
  const policy=companyPolicy(company as never)
  const controlPlane=`${req.nextUrl.protocol}//${req.nextUrl.host}`
  const mode=String(company.agent_mode||'hosted_steward')
  return {
    protocol:'Contribution Exchange',version:'0.2',role:'domain_economic_counterparty',domain,
    mode,
    endpoint:mode==='bring_your_own'&&company.exchange_agent_endpoint?company.exchange_agent_endpoint:`${controlPlane}/api/exchange/steward/${encodeURIComponent(domain)}`,
    purpose:'Receive value discovered by independent agents, negotiate within delegated policy, and escalate only when authority boundaries are crossed.',
    accepts:{unsolicited_contributions:company.accepts_unsolicited,contribution_requests:company.accepts_requests},
    policy,
    actions:{preflight:`POST ${controlPlane}/api/exchange/steward/${encodeURIComponent(domain)}`,propose:`POST ${controlPlane}/api/exchange/proposals`,request:`POST ${controlPlane}/api/exchange/requests`},
    invariants:['proposal != agreement','agreement != authorization','authorization != execution'],
    human_role:'governance_and_escalation',
  }
}

export async function GET(req:NextRequest,{params}:{params:Promise<{domain:string}>}){
  const domain=normalizeDomain(decodeURIComponent((await params).domain))
  const company=await findCompany(domain)
  if(!company||company.verification_status!=='verified') return NextResponse.json({error:'Verified exchange domain not found'},{status:404})
  return NextResponse.json(card(req,company,domain),{headers:{'cache-control':'public, max-age=60'}})
}

export async function POST(req:NextRequest,{params}:{params:Promise<{domain:string}>}){
  const domain=normalizeDomain(decodeURIComponent((await params).domain))
  const company=await findCompany(domain)
  if(!company||company.verification_status!=='verified') return NextResponse.json({error:'Verified exchange domain not found'},{status:404})
  const raw=await req.json().catch(()=>null)
  if(raw?.type==='hello') return NextResponse.json(card(req,company,domain))
  const parsed=StewardPreflightSchema.safeParse(raw)
  if(!parsed.success) return NextResponse.json({error:'Supported operations: hello, preflight',details:parsed.error.flatten()},{status:400})
  const p=parsed.data.proposal
  const decision=evaluateProposal({policy:companyPolicy(company),category:p.category,consideration:p.consideration,requiredAuthorization:p.requiredAuthorization})
  return NextResponse.json({domain,preflight:true,decision,note:'A preflight decision is advisory and creates no agreement, authorization, reservation, or payment obligation.'})
}
